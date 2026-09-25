import { Module } from "@nestjs/common";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

/**
 * Platform-admin console module (cross-tenant super-admin area). Guarded by the
 * global `PlatformAdminGuard` via the `@PlatformAdmin()` decorator on the
 * controller. AuditService is provided globally by CommonModule.
 */
@Module({
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
