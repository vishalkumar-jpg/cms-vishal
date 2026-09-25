import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { ReusableBlocksController } from "./reusable-blocks.controller";
import { ReusableBlocksService } from "./reusable-blocks.service";
import { PublicReusableBlocksController } from "./public-reusable-blocks.controller";
import { PublicReusableBlocksService } from "./public-reusable-blocks.service";

/**
 * REUSE-BLOCKS — per-site reusable / global synced blocks. ScopedRepository,
 * AuditService and QueueService come from the global CommonModule/QueueModule.
 * Imports SeoModule to reuse its SiteResolver for the host→site lookup used by
 * the PUBLIC resolver controller.
 */
@Module({
  imports: [SeoModule],
  controllers: [ReusableBlocksController, PublicReusableBlocksController],
  providers: [ReusableBlocksService, PublicReusableBlocksService],
  exports: [ReusableBlocksService],
})
export class ReusableBlocksModule {}
