import { Body, Controller, Get, Headers, Param, Post, Put, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { MonitoringService } from "./monitoring.service";
import {
  AuditsQueryDto,
  CrmDeliveriesQueryDto,
  ErrorsQueryDto,
  IngestErrorDto,
  LinksQueryDto,
  RunAuditDto,
  UpdateAuditConfigDto,
} from "./dto/monitoring.dto";

/**
 * Monitoring hub (backlog #29/#37/#30). Site-scoped + site_admin, EXCEPT the
 * @Public host-resolved error-ingest endpoint (rate-limited + deduped) which the
 * renderer/admin client can POST to without auth. Mounted at /api/monitoring.
 */
@ApiTags("monitoring")
@Controller("monitoring")
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  // --- #29 CRM-sync ---------------------------------------------------------

  @Get("crm-deliveries")
  @Roles("site_admin")
  @ApiOperation({ summary: "List this site's forms→CRM delivery rows" })
  async crmDeliveries(@Query() q: CrmDeliveriesQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.listCrmDeliveries(q) });
  }

  @Post("crm-deliveries/:id/retry")
  @Roles("site_admin")
  @ApiOperation({ summary: "Re-enqueue a forms→CRM delivery" })
  async retryCrm(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.monitoring.retryCrmDelivery(id, user);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }

  // --- #37 Runtime errors ---------------------------------------------------

  @Public()
  @Post("errors")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "monitoring-ingest" })
  @ApiOperation({ summary: "Ingest a runtime error (host-resolved, deduped, rate-limited)" })
  async ingestError(
    @PublicHost() host: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Body() dto: IngestErrorDto,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.monitoring.ingestError(host, dto, userAgent);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }

  @Get("errors")
  @Roles("site_admin")
  @ApiOperation({ summary: "List captured runtime errors for this site" })
  async errors(@Query() q: ErrorsQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.listErrors(q) });
  }

  // --- #30 Page audits ------------------------------------------------------

  @Get("audits")
  @Roles("site_admin")
  @ApiOperation({ summary: "List page-audit / certification rows" })
  async audits(@Query() q: AuditsQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.listAudits(q) });
  }

  @Post("audits/run")
  @Roles("site_admin")
  @ApiOperation({ summary: "Enqueue a real Lighthouse page-audit run for a path" })
  async runAudit(
    @Body() dto: RunAuditDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.monitoring.runAudit(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post("audits/scan-all")
  @Roles("site_admin")
  @ApiOperation({ summary: "Enqueue a Lighthouse audit for every published page (bulk scan)" })
  async scanAllAudits(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    const data = await this.monitoring.runBulkAudit(user);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }

  @Get("audits/summary")
  @Roles("site_admin")
  @ApiOperation({ summary: "Site-wide PageSpeed dashboard rollup (health, averages, best/worst)" })
  async auditSummary(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.getDashboardSummary() });
  }

  @Get("audits/config")
  @Roles("site_admin")
  @ApiOperation({ summary: "Read the site's scheduled-scan + performance-alert config" })
  async auditConfig(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.getAuditConfig() });
  }

  @Put("audits/config")
  @Roles("site_admin")
  @ApiOperation({ summary: "Update the site's scheduled-scan + performance-alert config" })
  async updateAuditConfig(
    @Body() dto: UpdateAuditConfigDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.updateAuditConfig(dto, user) });
  }

  @Get("audits/batch/:batchId")
  @Roles("site_admin")
  @ApiOperation({ summary: "Progress + rows for a bulk page-audit scan" })
  async auditBatch(@Param("batchId") batchId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.getBatchProgress(batchId) });
  }

  @Get("audits/:id/fixes")
  @Roles("site_admin")
  @ApiOperation({ summary: "Preview the auto-fixes available for an audit's page" })
  async auditFixes(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.previewAuditFixes(id) });
  }

  @Post("audits/:id/fixes/apply-automatic")
  @Roles("site_admin")
  @ApiOperation({ summary: "Apply every automatic auto-fix flagged on the audit's page" })
  async applyAllAutomaticFixes(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.monitoring.applyAllAutomaticFixes(id, user);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }

  @Post("audits/:id/fixes/:ruleId/apply")
  @Roles("site_admin")
  @ApiOperation({ summary: "Apply one auto-fix to the audit's page draft" })
  async applyAuditFix(
    @Param("id") id: string,
    @Param("ruleId") ruleId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.monitoring.applyAuditFix(id, ruleId, user);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }

  // --- SITE-HEALTH broken-link checker --------------------------------------

  @Post("links/check")
  @Roles("contributor")
  @ApiOperation({ summary: "Enqueue a broken-link crawl of this site's published pages" })
  async runLinkCheck(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    const data = await this.monitoring.runLinkCheck(user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get("links")
  @Roles("contributor")
  @ApiOperation({ summary: "Latest broken-link crawl run + its broken links" })
  async links(@Query() q: LinksQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.monitoring.getLatestLinkCheck(q) });
  }
}
