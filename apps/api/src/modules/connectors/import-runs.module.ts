import { Module } from "@nestjs/common";
import { ImportRunsService } from "./import-runs.service";

/** Durable import run history + per-item ledger (shared by connectors and HubSpot import). */
@Module({
  providers: [ImportRunsService],
  exports: [ImportRunsService],
})
export class ImportRunsModule {}
