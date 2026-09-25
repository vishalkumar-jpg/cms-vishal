import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { ConsentController } from "./consent.controller";
import { ConsentService } from "./consent.service";

/**
 * Consent Management (Privacy & Consent suite). The @Public consent-log beacon
 * resolves the tenant from the Host header via SiteResolver (SeoModule).
 * AuditService + QueueService come from the global CommonModule/QueueModule.
 */
@Module({
  imports: [SeoModule],
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
