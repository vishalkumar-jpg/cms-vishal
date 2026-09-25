import { Module } from "@nestjs/common";
import { StorageService } from "@modules/media/storage.service";
import { BackupsController } from "./backups.controller";
import { BackupsService } from "./backups.service";

/**
 * Platform-admin database backup module (gap E26, cross-tenant super-admin).
 * Guarded by the global `PlatformAdminGuard` via `@PlatformAdmin()` on the
 * controller. QueueService comes from the @Global QueueModule; AuditService from
 * the global CommonModule. StorageService (S3/MinIO) is provided here directly —
 * MediaModule doesn't export it — to delete/presign dump objects.
 */
@Module({
  controllers: [BackupsController],
  providers: [BackupsService, StorageService],
})
export class BackupsModule {}
