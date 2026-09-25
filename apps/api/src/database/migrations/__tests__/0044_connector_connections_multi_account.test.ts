import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";

const MIGRATION_PATH = join(
  import.meta.dir,
  "../../migrations/0044_connector_connections_multi_account.sql",
);

/** Opt-in PostgreSQL integration tests (docker/local CI service). Not required for unit CI. */
const MIGRATION_INTEGRATION_DATABASE_URL =
  process.env.MIGRATION_INTEGRATION_DATABASE_URL?.trim() ?? "";

const parseMigrationStatements = (sql: string): string[] =>
  sql
    .split("--> statement-breakpoint")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: string }).code === "23505";

const withSavepoint = async (
  client: PoolClient,
  run: () => Promise<void>,
): Promise<void> => {
  await client.query("SAVEPOINT migration_test_sp");
  try {
    await run();
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT migration_test_sp");
  }
};

const insertConnectorConnection = async (
  client: PoolClient,
  row: {
    id: string;
    siteId: string;
    connectorId: string;
    accountId: string | null;
    deletedAt?: Date | null;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO ob_cms.connector_connections (
      id, created_at, updated_at, deleted_at,
      site_id, connector_id, account_id,
      encrypted_credentials, credential_hint, metadata,
      is_connected, sync_enabled, sync_state
    ) VALUES (
      $1, now(), now(), $2,
      $3, $4, $5,
      'test-encrypted-credentials', 'hint', '{}'::jsonb,
      true, true, '{}'::jsonb
    )`,
    [row.id, row.deletedAt ?? null, row.siteId, row.connectorId, row.accountId],
  );
};

describe("0044_connector_connections_multi_account migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("drops single-connection unique index", () => {
    expect(sql).toContain('DROP INDEX IF EXISTS "ob_cms"."ccn_site_connector_uq"');
  });

  test("adds unique index on site + connector + account", () => {
    expect(sql).toContain('"ccn_site_connector_account_uq"');
    expect(sql).toContain('"site_id", "connector_id", "account_id"');
    expect(sql).toContain('"account_id" IS NOT NULL');
  });

  test("adds lookup index for connector connections", () => {
    expect(sql).toContain('"ccn_site_connector_idx"');
  });
});

const describePgIntegration = MIGRATION_INTEGRATION_DATABASE_URL
  ? describe.serial
  : describe.skip;

describePgIntegration("0044_connector_connections_multi_account PostgreSQL integration", () => {
  let pool: Pool;
  let client: PoolClient;
  let siteId: string;
  const connectorId = "hubspot";
  const runId = `ccn0044_${Date.now()}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: MIGRATION_INTEGRATION_DATABASE_URL });
    client = await pool.connect();

    const table = await client.query<{ reg: string | null }>(
      `SELECT to_regclass('ob_cms.connector_connections') AS reg`,
    );
    if (!table.rows[0]?.reg) {
      throw new Error(
        "ob_cms.connector_connections is missing; apply migration 0043 before integration tests",
      );
    }

    await client.query("BEGIN");

    for (const statement of parseMigrationStatements(readFileSync(MIGRATION_PATH, "utf8"))) {
      await client.query(statement);
    }

    const orgId = `${runId}_org`;
    siteId = `${runId}_site`;
    await client.query(
      `INSERT INTO ob_cms.organizations (id, name, slug, status, plan, created_at, updated_at)
       VALUES ($1, 'Migration 0044 Test Org', $2, 'active', '{}'::jsonb, now(), now())`,
      [orgId, `${runId}-org`],
    );
    await client.query(
      `INSERT INTO ob_cms.sites (
        id, org_id, name, slug, subdomain, status, visibility, created_at, updated_at
      ) VALUES ($1, $2, 'Migration 0044 Test Site', $3, $4, 'active', 'draft', now(), now())`,
      [siteId, orgId, `${runId}-site`, `${runId}.local`],
    );
  });

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  });

  test("rejects duplicate active rows with the same non-null account_id", async () => {
    await withSavepoint(client, async () => {
      const accountId = "portal-a";
      await insertConnectorConnection(client, {
        id: `${runId}_ccn_dup_a1`,
        siteId,
        connectorId,
        accountId,
      });

      let duplicateError: unknown;
      try {
        await insertConnectorConnection(client, {
          id: `${runId}_ccn_dup_a2`,
          siteId,
          connectorId,
          accountId,
        });
      } catch (error) {
        duplicateError = error;
      }
      expect(isUniqueViolation(duplicateError)).toBe(true);
    });
  });

  test("allows two active rows with different non-null account_id values", async () => {
    await withSavepoint(client, async () => {
      await insertConnectorConnection(client, {
        id: `${runId}_ccn_b1`,
        siteId,
        connectorId,
        accountId: "portal-b1",
      });
      await insertConnectorConnection(client, {
        id: `${runId}_ccn_b2`,
        siteId,
        connectorId,
        accountId: "portal-b2",
      });

      const count = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM ob_cms.connector_connections
         WHERE site_id = $1 AND connector_id = $2 AND deleted_at IS NULL
           AND account_id IN ('portal-b1', 'portal-b2')`,
        [siteId, connectorId],
      );
      expect(Number(count.rows[0]?.count)).toBe(2);
    });
  });

  test("allows multiple active rows when account_id is NULL", async () => {
    await withSavepoint(client, async () => {
      await insertConnectorConnection(client, {
        id: `${runId}_ccn_null_1`,
        siteId,
        connectorId,
        accountId: null,
      });
      await insertConnectorConnection(client, {
        id: `${runId}_ccn_null_2`,
        siteId,
        connectorId,
        accountId: null,
      });

      const count = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM ob_cms.connector_connections
         WHERE site_id = $1 AND connector_id = $2 AND deleted_at IS NULL AND account_id IS NULL`,
        [siteId, connectorId],
      );
      expect(Number(count.rows[0]?.count)).toBe(2);
    });
  });

  test("allows duplicate account_id when the prior row is soft-deleted", async () => {
    await withSavepoint(client, async () => {
      const accountId = "portal-deleted";
      await insertConnectorConnection(client, {
        id: `${runId}_ccn_del_1`,
        siteId,
        connectorId,
        accountId,
        deletedAt: new Date(),
      });
      await insertConnectorConnection(client, {
        id: `${runId}_ccn_del_2`,
        siteId,
        connectorId,
        accountId,
      });

      const count = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM ob_cms.connector_connections
         WHERE site_id = $1 AND connector_id = $2 AND account_id = $3`,
        [siteId, connectorId, accountId],
      );
      expect(Number(count.rows[0]?.count)).toBe(2);
    });
  });
});
