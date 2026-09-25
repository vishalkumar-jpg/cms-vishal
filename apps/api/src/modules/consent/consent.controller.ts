import { Body, Controller, Get, Ip, Param, Post, Put, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { ConsentService } from "./consent.service";
import {
  ConsentLogDto,
  UpdateConsentConfigDto,
  UpdateRetentionConfigDto,
} from "./dto/consent.dto";

/**
 * Consent Management Platform (Privacy & Consent suite).
 *
 *  - `POST /api/consent`               @Public host-resolved proof-of-consent log.
 *  - `GET/PUT /sites/:siteId/consent`  site_admin consent-banner config.
 *  - `GET/PUT /sites/:siteId/retention` site_admin data-retention windows.
 *  - `GET /sites/:siteId/consent/records` recent proof-of-consent records.
 *
 * Config routes are site_admin + audited; the public log is best-effort.
 */
@ApiTags("consent")
@Controller()
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  // -- Public proof-of-consent log (host-resolved) ----------------------------

  @Public()
  @Post("consent")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "consent-log" })
  @ApiOperation({ summary: "Record a proof-of-consent decision (host-resolved). Returns 204." })
  async log(
    @PublicHost() host: string | undefined,
    @Ip() ip: string | undefined,
    @Body() dto: ConsentLogDto,
    @Res() res: Response,
  ): Promise<Response> {
    await this.consent.log(host, dto, ip);
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  // -- Config (site_admin) ----------------------------------------------------

  @Get("sites/:siteId/consent")
  @Roles("site_admin")
  @ApiOperation({ summary: "Get the site's consent-banner config" })
  async getConfig(@Param("siteId") siteId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.consent.getConfig(siteId) });
  }

  @Put("sites/:siteId/consent")
  @Roles("site_admin")
  @ApiOperation({ summary: "Replace the site's consent-banner config (save = live)" })
  async updateConfig(
    @Param("siteId") siteId: string,
    @Body() dto: UpdateConsentConfigDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.consent.updateConfig(siteId, dto, user) });
  }

  @Get("sites/:siteId/retention")
  @Roles("site_admin")
  @ApiOperation({ summary: "Get the site's data-retention windows" })
  async getRetention(@Param("siteId") siteId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.consent.getRetention(siteId) });
  }

  @Put("sites/:siteId/retention")
  @Roles("site_admin")
  @ApiOperation({ summary: "Replace the site's data-retention windows" })
  async updateRetention(
    @Param("siteId") siteId: string,
    @Body() dto: UpdateRetentionConfigDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.consent.updateRetention(siteId, dto, user),
    });
  }

  @Get("sites/:siteId/consent/records")
  @Roles("site_admin")
  @ApiOperation({ summary: "Recent proof-of-consent records for the site" })
  async records(
    @Param("siteId") siteId: string,
    @Query("limit") limit: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    const n = limit ? Number(limit) : 50;
    return responseUtils.success(res, {
      data: await this.consent.recentRecords(siteId, Number.isFinite(n) ? n : 50),
    });
  }
}
