import { Module } from "@nestjs/common";
import { ContentLocksController } from "./content-locks.controller";
import { ContentLocksService } from "./content-locks.service";

/**
 * CONTENT-OPS — advisory concurrent-edit locking for the page/post builders.
 * ScopedRepository + TenantContext come from the global CommonModule.
 */
@Module({
  controllers: [ContentLocksController],
  providers: [ContentLocksService],
  exports: [ContentLocksService],
})
export class ContentLocksModule {}
