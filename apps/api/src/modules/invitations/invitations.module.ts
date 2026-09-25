import { Module } from "@nestjs/common";
import { InvitationsController, PublicInvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";

/** Email-based team invitations (governance). AuditService/MailService/
 *  PasswordService are provided globally by CommonModule. */
@Module({
  controllers: [InvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
