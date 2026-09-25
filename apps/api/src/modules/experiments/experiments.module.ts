import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { ExperimentsController } from "./experiments.controller";
import { ExperimentsService } from "./experiments.service";

/**
 * Experiments (Phase 4 A/B testing). Site-scoped CRUD over experiments + weighted
 * variants, lifecycle, and an on-read results rollup (exposures/conversions from
 * the analytics stream, a two-proportion z-test vs control). Two @Public,
 * host-resolved endpoints serve the renderer's Experiment block (variant defs)
 * and personalization (visitor→audiences) — both reuse SeoModule's SiteResolver.
 * See apps/api/EXPERIMENTS-PERSONALIZATION.md.
 */
@Module({
  imports: [SeoModule],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
