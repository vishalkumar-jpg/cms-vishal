import { Module } from "@nestjs/common";
import { SiteMembersController } from "./site-members.controller";
import { SiteMembersService } from "./site-members.service";

@Module({
  controllers: [SiteMembersController],
  providers: [SiteMembersService],
  exports: [SiteMembersService],
})
export class SiteMembersModule {}
