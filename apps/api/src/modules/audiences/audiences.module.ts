import { Module } from "@nestjs/common";
import { AudiencesController } from "./audiences.controller";
import { AudiencesService } from "./audiences.service";

/**
 * Audiences module (Phase 3). Segment definitions + memberships. Relies on the
 * @Global CommonModule (ScopedRepository/AuditService) and QueueModule
 * (QueueService) — no local imports needed. Rule evaluation is shared with the
 * identity module via @modules/identity/rules.
 */
@Module({
  controllers: [AudiencesController],
  providers: [AudiencesService],
  exports: [AudiencesService],
})
export class AudiencesModule {}
