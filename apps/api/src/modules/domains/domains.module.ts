import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { MockTlsService, TLS_SERVICE } from "./tls.service";

/**
 * CUSTOM-DOMAINS — tenant custom-domain binding + DNS verification + TLS seam.
 * Imports SeoModule for the SiteResolver (host→site cache invalidation).
 * The TLS provider is the dev mock; swap for an ACM/ACME impl in prod.
 */
@Module({
  imports: [SeoModule],
  controllers: [DomainsController],
  providers: [DomainsService, { provide: TLS_SERVICE, useClass: MockTlsService }],
  exports: [DomainsService],
})
export class DomainsModule {}
