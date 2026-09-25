import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { AnalyticsService } from "./analytics.service";
import { CollectDto, PagesQueryDto, RangeQueryDto, TimeseriesQueryDto } from "./dto/analytics.dto";

/**
 * Analytics ingest (@Public host-resolved beacon endpoint at /api/collect) +
 * the site-scoped stats API (@Roles("contributor"), served fast from the daily
 * rollup). The ingest resolves the tenant from the Host header — a client
 * siteId is NEVER trusted; stats reads go through ScopedRepository so a caller
 * only ever sees their active site's data.
 */
@ApiTags("analytics")
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // --- Ingest ---------------------------------------------------------------

  @Public()
  @Post("collect")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "analytics-collect" })
  @ApiOperation({ summary: "Ingest a first-party analytics beacon batch (host-resolved). Returns 204." })
  async collect(
    @PublicHost() host: string | undefined,
    @Body() dto: CollectDto,
    @Res() res: Response,
  ): Promise<Response> {
    await this.analytics.collect(host, dto);
    // Fire-and-forget beacon contract: no body, 204.
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  // --- Stats (site-scoped) --------------------------------------------------

  @Get("analytics/overview")
  @Roles("contributor")
  @ApiOperation({ summary: "Visitors/pageviews/avg-session/bounce + previous-window deltas" })
  async overview(@Query() q: RangeQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.analytics.overview(q.from, q.to) });
  }

  @Get("analytics/timeseries")
  @Roles("contributor")
  @ApiOperation({ summary: "Per-day visitors + pageviews across the range (dense)" })
  async timeseries(@Query() q: TimeseriesQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.analytics.timeseries(q.from, q.to) });
  }

  @Get("analytics/pages")
  @Roles("contributor")
  @ApiOperation({ summary: "Top pages by pageviews" })
  async pages(@Query() q: PagesQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.analytics.pages(q.from, q.to, q.limit ?? 20) });
  }

  @Get("analytics/sources")
  @Roles("contributor")
  @ApiOperation({ summary: "Visitors by acquisition channel" })
  async sources(@Query() q: RangeQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.analytics.sources(q.from, q.to) });
  }

  @Get("analytics/devices")
  @Roles("contributor")
  @ApiOperation({ summary: "Visitors by device type" })
  async devices(@Query() q: RangeQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.analytics.devices(q.from, q.to) });
  }

  @Get("analytics/web-vitals")
  @Roles("contributor")
  @ApiOperation({ summary: "Core Web Vitals p75 + good/needs-improvement/poor buckets" })
  async webVitals(@Query() q: RangeQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.analytics.webVitals(q.from, q.to) });
  }
}
