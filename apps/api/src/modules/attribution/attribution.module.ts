import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { AttributionController } from "./attribution.controller";
import { AttributionService } from "./attribution.service";

/**
 * Attribution (Phase 5). Marketing attribution over the Phase-2 analytics
 * touchpoint stream + a durable `attribution_conversions` table. A @Public,
 * host-resolved conversion beacon (reuses SeoModule's SiteResolver) and the
 * site-scoped reads (overview / model-comparison / recent). Exported so the
 * forms goal hook can record conversions. See apps/api/REVENUE-ORCHESTRATION.md.
 */
@Module({
  imports: [SeoModule],
  controllers: [AttributionController],
  providers: [AttributionService],
  exports: [AttributionService],
})
export class AttributionModule {}
