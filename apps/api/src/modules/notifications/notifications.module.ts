import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * NOTIFICATIONS — in-app header-bell notifications.
 *
 * Exports NotificationsService so the comment + editorial-workflow paths can
 * emit best-effort notifications (mirroring how WebhooksModule exports its
 * emitter). The service is not request-scoped and takes siteId explicitly.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
