import { Module } from "@nestjs/common";
import {
  TEMPLATE_SKELETON_ASSET_STORAGE,
  TEMPLATE_SKELETON_STORAGE,
} from "@ob-cms/template-registry";
import { TemplateSkeletonAssetRepository } from "./template-skeleton-asset.repository";
import { TemplateSkeletonAssetsService } from "./template-skeleton-assets.service";
import { TemplateSkeletonUsageService } from "./template-skeleton-usage.service";
import { TemplateSkeletonVersionRepository } from "./template-skeleton-version.repository";
import { TemplateSkeletonVersionService } from "./template-skeleton-version.service";
import { TemplateSkeletonRepository } from "./template-skeleton.repository";
import { TemplateSkeletonsController } from "./template-skeletons.controller";
import { TemplateSkeletonsService } from "./template-skeletons.service";

/**
 * Template skeleton catalog module — HTTP surface over Phase 1B-a persistence.
 * Registered in app.module during Phase 1C wiring.
 */
@Module({
  controllers: [TemplateSkeletonsController],
  providers: [
    TemplateSkeletonsService,
    TemplateSkeletonVersionService,
    TemplateSkeletonUsageService,
    TemplateSkeletonVersionRepository,
    TemplateSkeletonAssetsService,
    TemplateSkeletonRepository,
    TemplateSkeletonAssetRepository,
    { provide: TEMPLATE_SKELETON_STORAGE, useExisting: TemplateSkeletonRepository },
    { provide: TEMPLATE_SKELETON_ASSET_STORAGE, useExisting: TemplateSkeletonAssetRepository },
  ],
  exports: [
    TemplateSkeletonsService,
    TemplateSkeletonAssetsService,
    TemplateSkeletonVersionService,
    TemplateSkeletonUsageService,
  ],
})
export class TemplateSkeletonsModule {}
