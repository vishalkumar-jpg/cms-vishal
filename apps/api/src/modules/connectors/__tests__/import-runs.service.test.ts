import { describe, expect, mock, test } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { HUBSPOT_CONNECTOR_ID } from "@ob-cms/block-schema";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { ConnectorConnectionRow } from "@database/schema/connector-connections.schema";
import type { ImportRunRow, NewImportRunRow } from "@database/schema/import-runs.schema";
import {
  IMPORT_RUNS_LIST_DEFAULT_LIMIT,
  IMPORT_RUNS_LIST_MAX_LIMIT,
} from "../connectors.constants";
import { ImportRunsService } from "../import-runs.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

const startedAt = new Date("2026-09-15T10:00:00.000Z");

const connectionRow: ConnectorConnectionRow = {
  id: "ccn_hubspot",
  createdAt: startedAt,
  updatedAt: startedAt,
  deletedAt: null,
  createdBy: actor.userId,
  updatedBy: actor.userId,
  siteId: "site_test",
  connectorId: HUBSPOT_CONNECTOR_ID,
  accountId: "51993961",
  encryptedCredentials: "v1:enc",
  credentialHint: "pat-…abc",
  metadata: { accountLabel: "app.hubspot.com" },
  isConnected: true,
  connectedAt: startedAt,
  lastValidatedAt: startedAt,
  lastSyncAt: null,
  syncEnabled: true,
  syncState: {},
};

const runRow: ImportRunRow = {
  id: "imr_test",
  createdAt: startedAt,
  updatedAt: startedAt,
  deletedAt: null,
  createdBy: actor.userId,
  updatedBy: actor.userId,
  siteId: "site_test",
  connectionId: "ccn_hubspot",
  connectorId: HUBSPOT_CONNECTOR_ID,
  accountId: "51993961",
  accountLabel: "app.hubspot.com",
  scope: "published",
  status: "running",
  startedAt,
  completedAt: null,
  resultSummary: { importedPages: 0, importedPosts: 0, skipped: [] },
  errorMessage: null,
  correlationKey: null,
};

function createService(rows: ImportRunRow[] = []) {
  let stored = [...rows];
  let lastInsertPayload: NewImportRunRow | undefined;
  let lastListLimit: number | undefined;

  const db = {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock((...args: unknown[]) => {
            void args;
            return {
              limit: mock(async (n: number) => {
                lastListLimit = n;
                return stored.slice(0, n);
              }),
            };
          }),
          limit: mock(async (n: number) => stored.slice(0, n)),
        })),
      })),
    })),
    insert: mock(() => ({
      values: mock((payload: NewImportRunRow) => {
        lastInsertPayload = payload;
        return {
          returning: mock(async () => {
            const inserted = {
              ...runRow,
              ...payload,
              id: runRow.id,
              resultSummary: runRow.resultSummary,
            } satisfies ImportRunRow;
            stored = [...stored, inserted];
            return [inserted];
          }),
        };
      }),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(async () => {
            const updated = {
              ...runRow,
              status: "succeeded" as const,
              completedAt: new Date(),
              resultSummary: { importedPages: 2, importedPosts: 1, skipped: [] },
            };
            stored = [updated];
            return [updated];
          }),
        })),
      })),
    })),
  };

  const repo = {
    siteId: "site_test",
    db,
    scope: (_table: unknown, condition: unknown) => condition ?? true,
    insertDefaults: () => ({ id: runRow.id }),
  } as unknown as ScopedRepository;

  return {
    service: new ImportRunsService(repo),
    getStored: () => stored,
    getLastInsertPayload: () => lastInsertPayload,
    getLastListLimit: () => lastListLimit,
  };
}

describe("ImportRunsService", () => {
  test("startRun creates a running row with connection snapshots", async () => {
    const { service, getLastInsertPayload } = createService();
    const row = await service.startRun(connectionRow, "published", actor);
    const payload = getLastInsertPayload();
    expect(payload?.accountLabel).toBe("app.hubspot.com");
    expect(payload?.scope).toBe("published");
    expect(payload?.status).toBe("running");
    expect(payload?.correlationKey).toBe("hubspot:ccn_hubspot:published");
    expect(payload?.createdBy).toBe(actor.userId);
    expect(row.status).toBe("running");
    expect(row.connectionId).toBe("ccn_hubspot");
    expect(row.accountId).toBe("51993961");
  });

  test("recordRunItem inserts a ledger row", async () => {
    const insertValues = mock(async () => undefined);
    const repo = {
      siteId: "site_test",
      insertDefaults: () => ({ siteId: "site_test" }),
      db: {
        insert: mock(() => ({
          values: insertValues,
        })),
      },
    } as unknown as ScopedRepository;
    const service = new ImportRunsService(repo);
    await service.recordRunItem({
      runId: "imr_test",
      hubspotHsId: "page-1",
      hubspotKind: "page",
      status: "succeeded",
      obEntityType: "page",
      obEntityId: "pag_test",
      actor,
    });
    expect(insertValues).toHaveBeenCalled();
  });

  test("completeRunSuccess returns runId and summary fields", async () => {
    const { service } = createService([runRow]);
    const result = await service.completeRunSuccess(
      "imr_test",
      { importedPages: 2, importedPosts: 1, skipped: [] },
      actor,
    );
    expect(result.runId).toBe("imr_test");
    expect(result.importedPages).toBe(2);
    expect(result.importedPosts).toBe(1);
  });

  test("listRuns maps rows to safe DTOs", async () => {
    const { service } = createService([
      { ...runRow, status: "succeeded", completedAt: startedAt },
    ]);
    const runs = await service.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.connectorName).toBe("HubSpot");
    expect(runs[0]?.runId).toBe("imr_test");
  });

  test("listRuns applies default limit", async () => {
    const { service, getLastListLimit } = createService([runRow]);
    await service.listRuns();
    expect(getLastListLimit()).toBe(IMPORT_RUNS_LIST_DEFAULT_LIMIT);
  });

  test("listRuns clamps caller limit to max", async () => {
    const { service, getLastListLimit } = createService([runRow]);
    await service.listRuns(undefined, 9999);
    expect(getLastListLimit()).toBe(IMPORT_RUNS_LIST_MAX_LIMIT);
  });

  test("getRun throws when missing", async () => {
    const { service } = createService([]);
    await expect(service.getRun("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
