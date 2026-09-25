import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { PublicRenderController } from "./public-render.controller";
import { PublicRenderService } from "./public-render.service";

/**
 * PublicModule (WAVE3b §C) — the host-resolved, Redis-cached render API the
 * Next.js renderer consumes (/api/v1/public/site, /page, /navigation, /redirect).
 * Reuses SeoModule's SiteResolver. The publish→cache-purge job clears these
 * `render:<siteId>:*` keys (see CachePurgeProcessor in the worker).
 */
@Module({
  imports: [SeoModule],
  controllers: [PublicRenderController],
  providers: [PublicRenderService],
  exports: [PublicRenderService],
})
export class PublicModule {}
