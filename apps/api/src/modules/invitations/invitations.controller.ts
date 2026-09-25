import { Body, Controller, Delete, Get, Param, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { Public } from "@common/decorators/public.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { InvitationsService } from "./invitations.service";
import { AcceptInvitationDto, CreateInvitationDto } from "./dto/invitation.dto";

/**
 * Team invitations management. Site-scoped via the `X-Site-Id` header (the admin
 * Axios injects it), so paths are relative `/invitations`. Managing invites
 * requires site_admin.
 */
@ApiTags("invitations")
@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @Roles("site_admin")
  @ApiOperation({ summary: "List this site's invitations" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.invitations.list() });
  }

  @Post()
  @Roles("site_admin")
  @ApiOperation({ summary: "Invite a teammate by email" })
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.invitations.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post(":id/resend")
  @Roles("site_admin")
  @ApiOperation({ summary: "Resend a pending invitation" })
  async resend(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.invitations.resend(id, user) });
  }

  @Delete(":id")
  @Roles("site_admin")
  @ApiOperation({ summary: "Revoke an invitation" })
  async revoke(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.invitations.revoke(id, user) });
  }
}

/**
 * Public, token-resolved invitation endpoints (no auth, no active site). Used by
 * the admin `/accept-invite` page to preview and accept an invite.
 */
@ApiTags("invitations")
@Controller("public/invitations")
export class PublicInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(":token")
  @Public()
  @ApiOperation({ summary: "Preview an invitation (public)" })
  async preview(@Param("token") token: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.invitations.preview(token) });
  }

  @Post(":token/accept")
  @Public()
  @ApiOperation({ summary: "Accept an invitation (public)" })
  async accept(
    @Param("token") token: string,
    @Body() dto: AcceptInvitationDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.invitations.accept(token, dto) });
  }
}
