import { Module } from "@nestjs/common";
import { SeoModule } from "@modules/seo/seo.module";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

/**
 * Identity module (Phase 3). Imports SeoModule for the (non-global) SiteResolver
 * used by the @Public identify beacon. ScopedRepository/AuditService/QueueService
 * come from the @Global CommonModule/QueueModule. Exports IdentityService so the
 * forms-submit hook can call `linkEmail(...)` best-effort.
 */
@Module({
  imports: [SeoModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
