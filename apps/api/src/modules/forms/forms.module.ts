import { Module } from "@nestjs/common";
import { WebhooksModule } from "@modules/webhooks/webhooks.module";
import { SeoModule } from "@modules/seo/seo.module";
import { IdentityModule } from "@modules/identity/identity.module";
import { WorkflowsModule } from "@modules/workflows/workflows.module";
import { StorageService } from "@modules/media/storage.service";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { PublicFormsController } from "./public-forms.controller";
import { PublicFormsService } from "./public-forms.service";
import { PublicFormUploadService } from "./public-form-upload.service";
import { CaptchaService } from "./captcha.service";
import { FormNotifyService } from "./form-notify.service";
import { MockCrmController, MockCrmService } from "./mock-crm.controller";

/**
 * FormsModule (WAVE3b) — admin forms CRUD + submissions/export/resend + CRM
 * config, the PUBLIC host-resolved submit endpoint, and the local dev mock-CRM
 * receiver. Imports SeoModule to reuse its SiteResolver for host→site
 * resolution on the public submit path.
 */
@Module({
  imports: [WebhooksModule, SeoModule, IdentityModule, WorkflowsModule],
  controllers: [FormsController, PublicFormsController, MockCrmController],
  providers: [
    FormsService,
    PublicFormsService,
    PublicFormUploadService,
    CaptchaService,
    FormNotifyService,
    StorageService,
    MockCrmService,
  ],
  exports: [FormsService],
})
export class FormsModule {}
