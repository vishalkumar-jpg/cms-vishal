import { Module } from "@nestjs/common";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";

/**
 * DSAR / privacy module (Privacy & Consent suite). ScopedRepository + AuditService
 * come from the global CommonModule, so this only wires its own controller +
 * service. All access is site_admin + site-scoped + audited.
 */
@Module({
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
