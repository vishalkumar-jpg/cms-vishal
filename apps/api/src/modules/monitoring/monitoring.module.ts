import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { PagesModule } from "@modules/pages/pages.module";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";

/**
 * Monitoring hub (backlog #29/#37/#30):
 *  - #29 CRM-sync: reads the forms→CRM delivery state on `form_submissions`
 *        and re-enqueues a delivery via the existing CRM queue (QueueService,
 *        @Global). No delivery logic is reimplemented here.
 *  - #37 Runtime errors: a @Public host-resolved ingest (deduped + rate-limited)
 *        + a site-scoped list. Reuses SeoModule's SiteResolver for host→site.
 *  - #30 Page audits: a Lighthouse SEAM — records placeholder rows now; a real
 *        Lighthouse worker can overwrite later (see apps/api/MONITORING.md).
 */
@Module({
  imports: [SeoModule, PagesModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
