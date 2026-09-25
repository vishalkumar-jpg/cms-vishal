import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { PublicSearchController } from "./public-search.controller";
import { SiteSearchService } from "./site-search.service";

/**
 * Content search:
 *  - `SearchService`/`SearchController` — admin, X-Site-Id scoped, ILIKE, the
 *    ⌘K command palette backend.
 *  - `SiteSearchService`/`PublicSearchController` — PUBLIC on-site full-text
 *    search (#64) over the resolved site's PUBLISHED content. Reuses SeoModule's
 *    SiteResolver for host→site resolution (mirrors PublicModule).
 */
@Module({
  imports: [SeoModule],
  controllers: [SearchController, PublicSearchController],
  providers: [SearchService, SiteSearchService],
  exports: [SearchService, SiteSearchService],
})
export class SearchModule {}
