import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { AttributionModule } from "@modules/attribution/attribution.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

/**
 * Analytics pipeline (Phase 2a):
 *  - Ingest: a @Public host-resolved beacon endpoint (`/api/collect`) that
 *    bulk-inserts raw first-party events (pageviews + Core Web Vitals + custom
 *    events, NO PII). Reuses SeoModule's SiteResolver for host→site.
 *  - Stats: a site-scoped read API (`/api/analytics/*`, @Roles("contributor"))
 *    served fast from the `analytics_daily` rollup (populated hourly by the
 *    worker); web-vitals percentiles query raw events. See apps/api/ANALYTICS.md.
 */
@Module({
  imports: [SeoModule, AttributionModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
