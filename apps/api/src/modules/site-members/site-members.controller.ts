import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { SiteMembersService } from "./site-members.service";
import { AddMemberDto, UpdateRoleDto } from "./dto/site-member.dto";

/** Per-site team management. All routes carry :siteId → TenantGuard scopes them. */
@ApiTags("site-members")
@ApiParam({ name: "siteId", required: true })
@Controller("sites/:siteId/members")
export class SiteMembersController {
  constructor(private readonly members: SiteMembersService) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List members of this site" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.members.list() });
  }

  @Post()
  @Roles("site_admin")
  @ApiOperation({ summary: "Add an existing user as a member" })
  async add(
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.members.add(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":userId")
  @Roles("site_admin")
  @ApiOperation({ summary: "Change a member's role" })
  async updateRole(
    @Param("userId") userId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.members.updateRole(userId, dto, user),
    });
  }

  @Delete(":userId")
  @Roles("site_admin")
  @ApiOperation({ summary: "Remove a member" })
  async remove(
    @Param("userId") userId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.members.remove(userId, user) });
  }
}
