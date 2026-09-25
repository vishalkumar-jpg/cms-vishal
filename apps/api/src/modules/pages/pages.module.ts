import { Module } from "@nestjs/common";
import { RedirectsModule } from "@modules/redirects/redirects.module";
import { WebhooksModule } from "@modules/webhooks/webhooks.module";
import { NotificationsModule } from "@modules/notifications/notifications.module";
import { TemplateSkeletonsModule } from "@modules/template-skeletons/template-skeletons.module";
import { PagesController } from "./pages.controller";
import { PagesService } from "./pages.service";
import { TemplateInstantiationService } from "./template-instantiation.service";

@Module({
  imports: [RedirectsModule, WebhooksModule, NotificationsModule, TemplateSkeletonsModule],
  controllers: [PagesController],
  providers: [PagesService, TemplateInstantiationService],
  exports: [PagesService],
})
export class PagesModule {}
