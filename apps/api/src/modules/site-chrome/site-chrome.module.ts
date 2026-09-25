import { Module } from "@nestjs/common";
import { SiteChromeController } from "./site-chrome.controller";
import { SiteChromeService } from "./site-chrome.service";

/**
 * GLOBAL-CHROME — global header/footer for a site. ScopedRepository,
 * AuditService and QueueService come from the global CommonModule/QueueModule,
 * so this module only wires its own controller + service.
 */
@Module({
  controllers: [SiteChromeController],
  providers: [SiteChromeService],
  exports: [SiteChromeService],
})
export class SiteChromeModule {}
