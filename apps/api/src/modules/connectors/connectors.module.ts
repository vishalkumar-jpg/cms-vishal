import { Module } from "@nestjs/common";
import { AiModule } from "@modules/ai/ai.module";
import { HubspotImportModule } from "@modules/hubspot-import/hubspot-import.module";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorsImportService } from "./connectors-import.service";
import { ConnectorsService } from "./connectors.service";
import { ImportRunsModule } from "./import-runs.module";

/**
 * CONNECTORS — generic per-site provider connection lifecycle (HubSpot first).
 * EncryptionService comes from AiModule; tenancy/audit from global CommonModule.
 */
@Module({
  imports: [AiModule, HubspotImportModule, ImportRunsModule],
  controllers: [ConnectorsController],
  providers: [ConnectorsService, ConnectorsImportService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
