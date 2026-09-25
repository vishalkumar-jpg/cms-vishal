import { Module } from "@nestjs/common";
import { WebhooksModule } from "@modules/webhooks/webhooks.module";
import { BlogController } from "./blog.controller";
import { BlogService } from "./blog.service";

@Module({
  imports: [WebhooksModule],
  controllers: [BlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
