import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { RequirePermissions } from "@common/decorators/permissions.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { RolesService } from "./roles.service";
import {
  AssignCustomRoleDto,
  CreateCustomRoleDto,
  UpdateCustomRoleDto,
} from "./dto/custom-role.dto";

/**
 * RBAC-2: per-site custom-role management. Path-scoped under :siteId → TenantGuard
 * scopes every route. All routes keep `@Roles("site_admin")` (the coarse gate the
 * e2e gates assert). Mutations ALSO carry `@RequirePermissions("role.manage")` as
 * an opt-in fine-grained gate — a no-op for site_admins (who have all perms) but
 * enforceable for custom roles that lack role.manage.
 */
@ApiTags("roles")
@ApiParam({ name: "siteId", required: true, schema: { type: "string" } })
@Controller("sites/:siteId/roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get("permissions")
  @Roles("site_admin")
  @ApiOperation({ summary: "The permission catalog (domain-grouped)" })
  async catalog(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: this.roles.getPermissionCatalog() });
  }

  @Get()
  @Roles("site_admin")
  @ApiOperation({ summary: "List built-in + custom roles for this site" })
  async list(@Res() res: Response): Promise<Response> {
    const [builtin, custom] = await Promise.all([
      Promise.resolve(this.roles.listBuiltinRoles()),
      this.roles.listCustomRoles(),
    ]);
    return responseUtils.success(res, { data: { builtin, custom } });
  }

  @Post()
  @Roles("site_admin")
  @RequirePermissions("role.manage")
  @ApiOperation({ summary: "Create a custom role" })
  async create(
    @Body() dto: CreateCustomRoleDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.roles.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Put(":roleId")
  @Roles("site_admin")
  @RequirePermissions("role.manage")
  @ApiOperation({ summary: "Update a custom role" })
  async update(
    @Param("roleId") roleId: string,
    @Body() dto: UpdateCustomRoleDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.roles.update(roleId, dto, user) });
  }

  @Delete(":roleId")
  @Roles("site_admin")
  @RequirePermissions("role.manage")
  @ApiOperation({ summary: "Delete a custom role" })
  async remove(
    @Param("roleId") roleId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.roles.remove(roleId, user) });
  }

  @Patch("members/:userId")
  @Roles("site_admin")
  @RequirePermissions("member.manage")
  @ApiOperation({ summary: "Assign (or clear) a custom role for a member" })
  async assign(
    @Param("userId") userId: string,
    @Body() dto: AssignCustomRoleDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.roles.assignToMember(userId, dto.customRoleId ?? null, user),
    });
  }
}
