import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PublicSiteSearchQueryDto } from "./dto/public-site-search-query.dto";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { rateLimitConfig } from "@config/rate-limit.config";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { SiteSearchService } from "./site-search.service";

/**
 * PUBLIC on-site full-text search (#64) consumed by the Search block on the
 * published website (via the renderer's same-origin `/api/search` proxy). Lives
 * at /api/v1/public/search. The site is resolved SERVER-SIDE from the Host header
 * (never a client-supplied siteId) and only that site's PUBLISHED content is
 * searched — no cross-tenant leakage, no drafts. Rate-limited per IP.
 */
@ApiTags("public-search")
@Controller("public")
export class PublicSearchController {
  constructor(private readonly search: SiteSearchService) {}

  @Public()
  @Get("search")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "site-search" })
  @ApiOperation({
    summary: "Public full-text search of published pages/posts/collections (host-resolved)",
  })
  async query(
    @PublicHost() host: string | undefined,
    @Query() query: PublicSiteSearchQueryDto,
    @Res() res: Response,
  ): Promise<Response> {
    const { q, type, limit } = query;
    const n = limit ? Number.parseInt(limit, 10) : undefined;
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
    );
    return responseUtils.success(res, {
      data: await this.search.search(
        host,
        q ?? "",
        type || undefined,
        Number.isFinite(n) ? n : undefined,
      ),
    });
  }
}
