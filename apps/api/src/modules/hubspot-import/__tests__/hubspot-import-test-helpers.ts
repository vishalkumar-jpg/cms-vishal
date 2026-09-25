import { mock } from "bun:test";
import type { HubspotAssetMigrationService } from "../hubspot-asset-migration.service";

export function createMockHubspotAssetMigration(): HubspotAssetMigrationService {
  return {
    migrateUpmAssets: mock(async () => ({ urlMap: {}, diagnostics: [] })),
  } as unknown as HubspotAssetMigrationService;
}
