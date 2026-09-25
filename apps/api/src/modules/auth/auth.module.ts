import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/** Local JWT auth. Cross-cutting services (Password/Token/Mail/Membership/Audit)
 *  come from the global CommonModule. */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
