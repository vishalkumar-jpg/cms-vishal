import { describe, expect, mock, test } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { HUBSPOT_CONNECTOR_ID, HUBSPOT_IMPORT_SCOPES } from "@ob-cms/block-schema";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { ConnectorConnectionRow } from "@database/schema/connector-connections.schema";
import type { EncryptionService } from "@modules/ai/encryption.service";
import type { HubspotImportService } from "@modules/hubspot-import/hubspot-import.service";
import type { ImportRunsService } from "../import-runs.service";
import { ConnectorsImportService } from "../connectors-import.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

const hubspotRow: ConnectorConnectionRow = {
  id: "ccn_hubspot",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  createdBy: actor.userId,
  updatedBy: actor.userId,
  siteId: "site_test",
  connectorId: HUBSPOT_CONNECTOR_ID,
  accountId: "12345",
  encryptedCredentials: "v1:enc",
  credentialHint: "pat-…abc",
  metadata: {},
  isConnected: true,
  connectedAt: new Date(),
  lastValidatedAt: new Date(),
  lastSyncAt: null,
  syncEnabled: true,
  syncState: {},
};

function createService(opts?: {
  row?: ConnectorConnectionRow | null;
  decrypted?: string;
  previewResult?: unknown;
  runResult?: unknown;
}) {
  const row = opts?.row === undefined ? hubspotRow : opts.row;
  const previewImport = mock(async () => opts?.previewResult ?? { scope: "published", pages: {}, posts: {} });
  const runScoped = mock(async () => opts?.runResult ?? { importedPages: 1, importedPosts: 0, skipped: [] });

  const hubspotImport = {
    previewScoped: previewImport,
    runScoped,
  } as unknown as HubspotImportService;

  const encryption = {
    decrypt: mock(() => opts?.decrypted ?? JSON.stringify({ accessToken: "pat-test" })),
  } as unknown as EncryptionService;

  const repo = {
    db: {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(async () => (row ? [row] : [])),
          })),
        })),
      })),
    },
    scope: mock((_table: unknown, condition: unknown) => condition),
  } as unknown as ScopedRepository;

  const importRuns = {
    startRun: mock(async () => ({ id: "imr_test" })),
    completeRunSuccess: mock(async (_id: string, summary: unknown) => ({
      runId: "imr_test",
      ...(summary as Record<string, unknown>),
    })),
    completeRunFailure: mock(async () => undefined),
  };

  const importRunsService = importRuns as unknown as ImportRunsService;

  const service = new ConnectorsImportService(
    repo,
    encryption,
    hubspotImport,
    importRunsService,
  );
  return { service, previewImport, runScoped, encryption, importRuns };
}

describe("ConnectorsImportService", () => {
  test("previewImport delegates to HubSpot with decrypted token", async () => {
    const preview = { scope: "published", pages: { toImport: 2 }, posts: { toImport: 0 } };
    const { service, previewImport } = createService({ previewResult: preview });

    const result = await service.previewImport("ccn_hubspot", "published");
    expect(result).toEqual(preview);
    expect(previewImport).toHaveBeenCalledWith("pat-test", "published");
  });

  test("runImport marks run failed and rethrows when runScoped rejects", async () => {
    const hubspotError = new Error("HubSpot import failed");
    const { service, runScoped, importRuns } = createService();
    runScoped.mockImplementation(async () => {
      throw hubspotError;
    });

    await expect(
      service.runImport("ccn_hubspot", HUBSPOT_IMPORT_SCOPES[0], actor),
    ).rejects.toBe(hubspotError);
    expect(importRuns.completeRunFailure).toHaveBeenCalledWith(
      "imr_test",
      "HubSpot import failed",
      actor,
    );
    expect(importRuns.completeRunSuccess).not.toHaveBeenCalled();
  });

  test("runImport rethrows when completeRunSuccess fails without marking run failed", async () => {
    const summary = { importedPages: 1, importedPosts: 0, skipped: [] };
    const persistError = new Error("Could not persist import run");
    const { service, runScoped, importRuns } = createService({ runResult: summary });
    importRuns.completeRunSuccess.mockImplementation(async () => {
      throw persistError;
    });

    await expect(
      service.runImport("ccn_hubspot", HUBSPOT_IMPORT_SCOPES[0], actor),
    ).rejects.toBe(persistError);
    expect(runScoped).toHaveBeenCalled();
    expect(importRuns.completeRunSuccess).toHaveBeenCalled();
    expect(importRuns.completeRunFailure).not.toHaveBeenCalled();
  });

  test("runImport persists import run and returns runId with summary", async () => {
    const summary = { importedPages: 3, importedPosts: 1, skipped: [] };
    const { service, runScoped, importRuns } = createService({ runResult: summary });

    const result = await service.runImport("ccn_hubspot", "all", actor);
    expect(result.runId).toBe("imr_test");
    expect(result.importedPages).toBe(3);
    expect(runScoped).toHaveBeenCalledWith("pat-test", "all", actor, {
      connectionId: "ccn_hubspot",
      runId: "imr_test",
    });
    expect(importRuns.startRun).toHaveBeenCalled();
    expect(importRuns.completeRunSuccess).toHaveBeenCalled();
  });

  test("previewImport passes selected scope through to HubSpot preview", async () => {
    const allPreview = { scope: "all", pages: { toImport: 907 }, posts: { toImport: 0 } };
    const { service, previewImport } = createService({ previewResult: allPreview });

    const result = await service.previewImport("ccn_hubspot", "all");
    expect(result).toEqual(allPreview);
    expect(previewImport).toHaveBeenCalledWith("pat-test", "all");
  });

  test("rejects missing connection", async () => {
    const { service } = createService({ row: null });
    await expect(service.previewImport("missing", "published")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("rejects connector without import capability", async () => {
    const { service } = createService({
      row: { ...hubspotRow, connectorId: "unknown-connector" },
    });
    await expect(service.previewImport("ccn_hubspot", "published")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  test("rejects empty stored credentials", async () => {
    const { service } = createService({ decrypted: JSON.stringify({ accessToken: "  " }) });
    await expect(service.previewImport("ccn_hubspot", "published")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
