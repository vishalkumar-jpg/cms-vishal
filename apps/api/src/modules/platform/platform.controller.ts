import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { PlatformAdmin } from "@common/decorators/platform-admin.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { PlatformService } from "./platform.service";
import { PlatformCreateSiteDto } from "./dto/platform.dto";

/**
 * Platform-admin console API — CROSS-TENANT, super-admin only.
 *
 * The whole controller is `@PlatformAdmin()`, so the global PlatformAdminGuard
 * hard-fails (403) for any caller without `isPlatformAdmin`. These routes carry
 * NO `X-Site-Id` and are NOT site-scoped: the service reads the raw `db` across
 * every tenant.
 */
@ApiTags("platform")
@PlatformAdmin()
@Controller("platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("overview")
  @ApiOperation({ summary: "Cross-tenant platform totals (platform admin only)" })
  async overview(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.platform.overview() });
  }

  @Get("sites")
  @ApiOperation({ summary: "All sites across all tenants with per-site stats" })
  async listSites(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.platform.listSites() });
  }

  @Post("sites")
  @ApiOperation({ summary: "Create a new tenant/site from the console" })
  async createSite(
    @Body() dto: PlatformCreateSiteDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.platform.createSite(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post("sites/:id/suspend")
  @ApiOperation({ summary: "Suspend a site (stops serving the public runtime)" })
  async suspend(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.platform.suspendSite(id, user) });
  }

  @Post("sites/:id/activate")
  @ApiOperation({ summary: "Re-activate a suspended site" })
  async activate(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.platform.activateSite(id, user) });
  }

  @Get("users")
  @ApiOperation({ summary: "All platform/system users" })
  async listUsers(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.platform.listUsers() });
  }
}
