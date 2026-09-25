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
import { AttributionService } from "./attribution.service";
import { AttributionQueryDto } from "./dto/attribution.dto";

/**
 * Attribution (Phase 5). A @Public host-resolved conversion beacon (mirrors
 * /collect — accepts an optional revenue `value` + `label`) plus the site-scoped
 * reads (@Roles("contributor")): overview (totals + by-source/campaign/page),
 * a first/last/linear model comparison, and a recent-conversions list. All
 * reads go through ScopedRepository so a caller only sees their site's data.
 */
@ApiTags("attribution")
@Controller()
export class AttributionController {
  constructor(private readonly attribution: AttributionService) {}

  // --- Ingest ---------------------------------------------------------------

  @Public()
  @Post("attribution/collect")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "attribution-collect" })
  @ApiOperation({ summary: "Record a conversion beacon (host-resolved, optional value+label). Returns 204." })
  async collect(
    @PublicHost() host: string | undefined,
    @Body() body: { visitorId: string; value?: number; label?: string; type?: string; path?: string },
    @Res() res: Response,
  ): Promise<Response> {
    await this.attribution.recordConversion(host, body ?? { visitorId: "" });
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  // --- Reads (site-scoped) --------------------------------------------------

  @Get("attribution/overview")
  @Roles("contributor")
  @ApiOperation({ summary: "Totals + conversions/revenue by source, campaign, landing page (per model)" })
  async overview(@Query() q: AttributionQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.attribution.overview(q.from, q.to, q.model ?? "last"),
    });
  }

  @Get("attribution/models")
  @Roles("contributor")
  @ApiOperation({ summary: "Compare first / last / linear attribution side by side (by source)" })
  async models(@Query() q: AttributionQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.attribution.models(q.from, q.to) });
  }

  @Get("attribution/conversions")
  @Roles("contributor")
  @ApiOperation({ summary: "Recent conversions in the window (id, ts, value, label)" })
  async conversions(@Query() q: AttributionQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.attribution.recent(q.from, q.to) });
  }
}
