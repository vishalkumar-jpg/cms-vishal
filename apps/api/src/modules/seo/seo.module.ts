import { Module } from "@nestjs/common";
import { SeoController } from "./seo.controller";
import { SeoService } from "./seo.service";
import { SiteResolver } from "./site-resolver.service";

@Module({
  controllers: [SeoController],
  providers: [SeoService, SiteResolver],
  exports: [SeoService, SiteResolver],
})
export class SeoModule {}
