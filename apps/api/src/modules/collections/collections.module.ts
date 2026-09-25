import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
import { PublicCollectionsController } from "./public-collections.controller";
import { PublicCollectionsService } from "./public-collections.service";

/**
 * CollectionsModule (WAVE5) — dynamic content types. Admin CRUD for collections
 * + their items (draft/published lifecycle) and the PUBLIC host-resolved render
 * surface. Imports SeoModule to reuse its SiteResolver for host→site resolution
 * on the public path.
 */
@Module({
  imports: [SeoModule],
  controllers: [CollectionsController, PublicCollectionsController],
  providers: [CollectionsService, PublicCollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
