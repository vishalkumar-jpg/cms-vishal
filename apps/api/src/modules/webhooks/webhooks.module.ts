import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { WebhooksEmitter } from "./webhooks-emitter.service";

/**
 * Webhooks (E27) — site-scoped admin CRUD for subscriptions + the send-test
 * endpoint, plus the WebhooksEmitter seam other modules call to raise events.
 * WebhooksEmitter is exported so the pages/blog/forms publish paths can inject
 * it (one-line call-sites documented in apps/api/CONTENT-API.md).
 */
@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksEmitter],
  exports: [WebhooksEmitter],
})
export class WebhooksModule {}
