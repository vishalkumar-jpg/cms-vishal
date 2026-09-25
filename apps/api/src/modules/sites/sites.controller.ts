import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { SitesService } from "./sites.service";
import { CreateSiteDto, UpdateSiteDto, UpdateSiteSettingsDto } from "./dto/site.dto";
import {
  CachePurgeDto,
  UpdateCdnDto,
  UpdateIntegrationsDto,
  UpdateLocalesDto,
} from "./dto/site-settings-hub.dto";

@ApiTags("sites")
@Controller("sites")
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Post()
  @Roles("super_admin")
  @ApiOperation({ summary: "Create a site (tenant). super_admin only." })
  async create(
    @Body() dto: CreateSiteDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.sites.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get()
  @ApiOperation({ summary: "List sites I can access (super_admin sees all)" })
  async list(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.list(user) });
  }

  // Per-site routes carry :siteId — the TenantGuard validates membership on it.

  @Get(":siteId")
  @Roles("contributor")
  async get(@Param("siteId") siteId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.get(siteId) });
  }

  @Patch(":siteId")
  @Roles("site_admin")
  async update(
    @Param("siteId") siteId: string,
    @Body() dto: UpdateSiteDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.update(siteId, dto, user) });
  }

  @Delete(":siteId")
  @Roles("super_admin")
  async archive(
    @Param("siteId") siteId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.archive(siteId, user) });
  }

  @Get(":siteId/settings")
  @Roles("contributor")
  async getSettings(@Param("siteId") siteId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.getSettings(siteId) });
  }

  @Patch(":siteId/settings")
  @Roles("site_admin")
  async updateSettings(
    @Param("siteId") siteId: string,
    @Body() dto: UpdateSiteSettingsDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.sites.updateSettings(siteId, dto, user),
    });
  }

  // -- i18n / localization (B13) --------------------------------------------

  @Get(":siteId/locales")
  @Roles("contributor")
  @ApiOperation({ summary: "Get the site's locale set (defaultLocale + locales)" })
  async getLocales(@Param("siteId") siteId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.getLocales(siteId) });
  }

  @Put(":siteId/locales")
  @Roles("site_admin")
  @ApiOperation({ summary: "Replace the site's locale set (default always included)" })
  async updateLocales(
    @Param("siteId") siteId: string,
    @Body() dto: UpdateLocalesDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.updateLocales(siteId, dto, user) });
  }

  // -- Site Settings hub: integrations (#32) --------------------------------

  @Get(":siteId/integrations")
  @Roles("site_admin")
  @ApiOperation({ summary: "Get the site's third-party integrations config" })
  async getIntegrations(@Param("siteId") siteId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.getIntegrations(siteId) });
  }

  @Put(":siteId/integrations")
  @Roles("site_admin")
  @ApiOperation({ summary: "Replace the site's integrations (GA4/chat/head+body scripts)" })
  async updateIntegrations(
    @Param("siteId") siteId: string,
    @Body() dto: UpdateIntegrationsDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.sites.updateIntegrations(siteId, dto, user),
    });
  }

  // -- Site Settings hub: CDN cache (#31) -----------------------------------

  @Get(":siteId/cdn")
  @Roles("site_admin")
  @ApiOperation({ summary: "Get the site's CDN cache config" })
  async getCdn(@Param("siteId") siteId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.getCdn(siteId) });
  }

  @Put(":siteId/cdn")
  @Roles("site_admin")
  @ApiOperation({ summary: "Replace the site's CDN cache config (ttl + rules)" })
  async updateCdn(
    @Param("siteId") siteId: string,
    @Body() dto: UpdateCdnDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.updateCdn(siteId, dto, user) });
  }

  @Post(":siteId/cache/purge")
  @Roles("site_admin")
  @ApiOperation({ summary: "Enqueue a render-cache purge (scope all | path)" })
  async purgeCache(
    @Param("siteId") siteId: string,
    @Body() dto: CachePurgeDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.sites.purgeCache(siteId, dto, user) });
  }
}
