import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { HUBSPOT_CONNECTOR_ID, HUBSPOT_OB_SANDBOX_PORTAL_ID } from "@ob-cms/block-schema";
import type { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { ConnectorConnectionRow } from "@database/schema/connector-connections.schema";
import type { EncryptionService } from "@modules/ai/encryption.service";
import {
  CONNECTOR_CONNECTION_ACCOUNT_UNIQUE_INDEX,
  POSTGRES_UNIQUE_VIOLATION_CODE,
} from "../connectors.constants";
import { ConnectorsService } from "../connectors.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

const ACTIVE_SITE_ID = "site_test";
const CONNECTED_AT = new Date("2026-03-01T12:00:00.000Z");
const PORTAL_A = HUBSPOT_OB_SANDBOX_PORTAL_ID;
const PORTAL_B = "98765432";

const connectedRowA: ConnectorConnectionRow = {
  id: "ccn_a",
  createdAt: CONNECTED_AT,
  updatedAt: CONNECTED_AT,
  deletedAt: null,
  createdBy: actor.userId,
  updatedBy: actor.userId,
  siteId: ACTIVE_SITE_ID,
  connectorId: HUBSPOT_CONNECTOR_ID,
  accountId: PORTAL_A,
  encryptedCredentials: "v1:enc_a",
  credentialHint: "pat-…abc1",
  metadata: { portalId: PORTAL_A, accountLabel: "app.hubspot.com" },
  isConnected: true,
  connectedAt: CONNECTED_AT,
  lastValidatedAt: CONNECTED_AT,
  lastSyncAt: null,
  syncEnabled: true,
  syncState: {},
};

const connectedRowB: ConnectorConnectionRow = {
  ...connectedRowA,
  id: "ccn_b",
  accountId: PORTAL_B,
  encryptedCredentials: "v1:enc_b",
  credentialHint: "pat-…xyz9",
  metadata: { portalId: PORTAL_B, accountLabel: "staging.hubspot.com" },
};

function createService(opts?: {
  rows?: ConnectorConnectionRow[];
  insertReturning?: ConnectorConnectionRow[];
  /** When set, limit(1) selects simulate findActiveByAccount(connectorId, accountId). */
  activeAccountLookup?: { connectorId: string; accountId: string };
  insertError?: unknown;
}) {
  const auditCalls: unknown[] = [];
  let rows = [...(opts?.rows ?? [])];
  const insertReturning = opts?.insertReturning ?? [connectedRowA];

  const db = {
    select: mock(() => ({
      from: mock(() => ({
        where: mock((condition: unknown) => {
          const result = Promise.resolve(rows);
          return Object.assign(
            {
              limit: mock(async (n: number) => {
                let pool = rows.filter((row) => row.isConnected);
                if (n === 1 && opts?.activeAccountLookup) {
                  pool = pool.filter(
                    (row) =>
                      row.connectorId === opts.activeAccountLookup!.connectorId &&
                      row.accountId === opts.activeAccountLookup!.accountId,
                  );
                }
                return pool.slice(0, n);
              }),
            },
            {
              then: result.then.bind(result),
            },
          );
        }),
      })),
    })),
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(async () => {
          if (opts?.insertError) {
            throw opts.insertError;
          }
          rows = [...rows, ...insertReturning];
          return insertReturning;
        }),
      })),
    })),
    update: mock(() => ({
      set: mock((patch: Partial<ConnectorConnectionRow>) => ({
        where: mock(async () => {
          const targetId =
            patch.isConnected === false
              ? rows.find((row) => row.isConnected)?.id
              : undefined;
          if (targetId) {
            rows = rows.map((row) =>
              row.id === targetId ? { ...row, ...patch } : row,
            );
          }
        }),
      })),
    })),
  };

  db.transaction = mock(async (fn: (tx: typeof db) => Promise<unknown>) =>
    fn(db),
  );

  const encryption = {
    encrypt: mock((value: string) => `enc:${value}`),
    decrypt: mock(() => "secret"),
    mask: mock(() => "pat-…abc1"),
  } satisfies Pick<EncryptionService, "encrypt" | "decrypt" | "mask">;

  const audit = {
    record: mock(async (entry: unknown) => {
      auditCalls.push(entry);
    }),
  } satisfies Pick<AuditService, "record">;

  const repo = {
    siteId: ACTIVE_SITE_ID,
    db,
    scope: (_table: unknown, ...conds: unknown[]) => conds[0] ?? true,
    insertDefaults: () => ({ siteId: ACTIVE_SITE_ID, createdBy: actor.userId }),
  } satisfies Pick<ScopedRepository, "siteId" | "db" | "scope" | "insertDefaults">;

  const service = new ConnectorsService(
    repo as ScopedRepository,
    encryption as EncryptionService,
    audit as AuditService,
  );

  return { service, encryption, auditCalls, db, getRows: () => rows };
}

describe("ConnectorsService", () => {
  const originalFetch = globalThis.fetch;
  const originalPortalPlural = process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
  const originalPortalEnv = process.env.HUBSPOT_ALLOWED_PORTAL_ID;

  beforeEach(() => {
    delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/account-info/v3/details")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ uiDomain: "app.hubspot.com" }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ portalId: Number(PORTAL_A) }),
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalPortalPlural === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_IDS = originalPortalPlural;
    }
    if (originalPortalEnv === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_ID = originalPortalEnv;
    }
  });

  test("returns 404 for unknown connector", async () => {
    const { service } = createService();
    await expect(service.listConnections("salesforce")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("returns empty list when no connections exist", async () => {
    const { service } = createService();
    const connections = await service.listConnections();
    expect(connections).toEqual([]);
  });

  test("maps connected rows to safe DTOs without encrypted credentials", async () => {
    const { service } = createService({ rows: [connectedRowA] });
    const connections = await service.listConnections();
    expect(connections).toHaveLength(1);
    expect(connections[0]?.connectionId).toBe("ccn_a");
    expect(connections[0]?.connected).toBe(true);
    expect(connections[0]?.accountId).toBe(PORTAL_A);
    expect(connections[0]?.accountLabel).toBe("app.hubspot.com");
    expect(connections[0]).not.toHaveProperty("encryptedCredentials");
  });

  test("rejects missing required configuration fields", async () => {
    const { service } = createService();
    await expect(
      service.createConnection(HUBSPOT_CONNECTOR_ID, {}, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test("encrypts credentials and records audit on create", async () => {
    const { service, encryption, auditCalls } = createService();
    const connection = await service.createConnection(
      HUBSPOT_CONNECTOR_ID,
      { accessToken: "valid-token-123" },
      actor,
    );

    expect(encryption.encrypt).toHaveBeenCalledWith('{"accessToken":"valid-token-123"}');
    expect(encryption.mask).toHaveBeenCalledWith("valid-token-123");
    expect(connection.connected).toBe(true);
    expect(connection.accountId).toBe(PORTAL_A);
    expect(auditCalls).toHaveLength(1);
    expect((auditCalls[0] as { metadata?: Record<string, unknown> }).metadata).toMatchObject({
      connectorId: HUBSPOT_CONNECTOR_ID,
      accountId: PORTAL_A,
    });
  });

  test("rejects duplicate account connections", async () => {
    const { service } = createService({
      rows: [connectedRowA],
      activeAccountLookup: { connectorId: HUBSPOT_CONNECTOR_ID, accountId: PORTAL_A },
    });
    await expect(
      service.createConnection(
        HUBSPOT_CONNECTOR_ID,
        { accessToken: "valid-token-123" },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test("allows a second connection for the same connector when account differs", async () => {
    process.env.HUBSPOT_ALLOWED_PORTAL_IDS = `${PORTAL_A},${PORTAL_B}`;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/account-info/v3/details")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ uiDomain: "staging.hubspot.com" }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ portalId: Number(PORTAL_B) }),
      } as Response;
    }) as typeof fetch;

    const { service, getRows } = createService({
      rows: [connectedRowA],
      insertReturning: [connectedRowB],
      activeAccountLookup: { connectorId: HUBSPOT_CONNECTOR_ID, accountId: PORTAL_B },
    });

    const connection = await service.createConnection(
      HUBSPOT_CONNECTOR_ID,
      { accessToken: "other-token-456" },
      actor,
    );
    expect(connection.accountId).toBe(PORTAL_B);
    expect(getRows().map((row) => row.id).sort()).toEqual(["ccn_a", "ccn_b"]);
  });

  test("maps concurrent duplicate account insert to ConflictException", async () => {
    const insertError = Object.assign(new Error("duplicate key"), {
      code: POSTGRES_UNIQUE_VIOLATION_CODE,
      constraint: CONNECTOR_CONNECTION_ACCOUNT_UNIQUE_INDEX,
    });
    const { service } = createService({
      rows: [],
      insertError,
      activeAccountLookup: { connectorId: HUBSPOT_CONNECTOR_ID, accountId: PORTAL_A },
    });

    await expect(
      service.createConnection(HUBSPOT_CONNECTOR_ID, { accessToken: "valid-token-123" }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test("lists multiple connections for the same connector", async () => {
    const { service } = createService({ rows: [connectedRowA, connectedRowB] });
    const connections = await service.listConnections(HUBSPOT_CONNECTOR_ID);
    expect(connections).toHaveLength(2);
    expect(connections.map((item) => item.connectionId).sort()).toEqual(["ccn_a", "ccn_b"]);
  });

  test("rejects disallowed HubSpot portals", async () => {
    globalThis.fetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ portalId: 99999999 }),
    })) as typeof fetch;

    const { service } = createService();
    await expect(
      service.createConnection(HUBSPOT_CONNECTOR_ID, { accessToken: "valid-token-123" }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test("disconnect targets one connection by connectionId", async () => {
    const { service, auditCalls } = createService({ rows: [connectedRowA, connectedRowB] });
    const disconnected = await service.disconnectConnection("ccn_a", actor);

    expect(disconnected.connectionId).toBe("ccn_a");
    expect(disconnected.connected).toBe(false);
    expect(disconnected.credentialHint).toBeNull();
    expect(auditCalls).toHaveLength(1);
    expect((auditCalls[0] as { metadata?: Record<string, unknown> }).metadata).toMatchObject({
      connectionId: "ccn_a",
      connectorId: HUBSPOT_CONNECTOR_ID,
    });
  });

  test("listCatalog reports connection counts per connector", async () => {
    const { service } = createService({ rows: [connectedRowA, connectedRowB] });
    const catalog = await service.listCatalog();

    const hubspot = catalog.find((item) => item.id === HUBSPOT_CONNECTOR_ID);
    expect(hubspot?.connectionCount).toBe(2);
  });
});
