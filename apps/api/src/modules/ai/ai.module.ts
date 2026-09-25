import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { EncryptionService } from "./encryption.service";

/**
 * WAVE4a — AI copilot (BYOK page generation). ScopedRepository, AuditService and
 * QueueService come from the global CommonModule/QueueModule, so this module only
 * declares its own controller + services.
 */
@Module({
  controllers: [AiController],
  providers: [AiService, EncryptionService],
  exports: [AiService, EncryptionService],
})
export class AiModule {}
