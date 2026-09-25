import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";

/** AuditService itself is provided globally by CommonModule; this exposes the
 *  read-only listing endpoint. */
@Module({
  controllers: [AuditController],
})
export class AuditModule {}
