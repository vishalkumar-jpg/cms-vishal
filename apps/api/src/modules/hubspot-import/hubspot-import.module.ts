import { Module } from "@nestjs/common";
import { PagesModule } from "@modules/pages/pages.module";
import { BlogModule } from "@modules/blog/blog.module";
import { ImportRunsModule } from "@modules/connectors/import-runs.module";
import { MediaModule } from "@modules/media/media.module";
import { HubspotImportController } from "./hubspot-import.controller";
import { HubspotAssetMigrationService } from "./hubspot-asset-migration.service";
import { HubspotImportService } from "./hubspot-import.service";

/**
 * HubSpot migration module (backlog #28). Reuses PagesService + BlogService to
 * create imported content through the normal draft-create path.
 */
@Module({
  imports: [PagesModule, BlogModule, ImportRunsModule, MediaModule],
  controllers: [HubspotImportController],
  providers: [HubspotImportService, HubspotAssetMigrationService],
  exports: [HubspotImportService, HubspotAssetMigrationService],
})
export class HubspotImportModule {}
