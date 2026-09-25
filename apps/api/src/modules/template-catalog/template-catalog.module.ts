import { Module } from "@nestjs/common";
import { TEMPLATE_CATALOG_STORAGE } from "@ob-cms/template-registry";
import { TemplateCatalogController } from "./template-catalog.controller";
import { TemplateCatalogRepository } from "./template-catalog.repository";
import { TemplateCatalogService } from "./template-catalog.service";

/**
 * Template catalog module — read-only browse projection over skeleton rows.
 * Registered in `app.module.ts` (Phase 2D).
 */
@Module({
  controllers: [TemplateCatalogController],
  providers: [
    TemplateCatalogService,
    TemplateCatalogRepository,
    { provide: TEMPLATE_CATALOG_STORAGE, useExisting: TemplateCatalogRepository },
  ],
  exports: [TemplateCatalogService],
})
export class TemplateCatalogModule {}
