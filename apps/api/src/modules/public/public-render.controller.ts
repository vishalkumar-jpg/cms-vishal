import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { PublicRenderService } from "./public-render.service";

/**
 * CDN/ISR cache hint for public render reads (WAVE4b perf). Browsers don't cache
 * (max-age=0) but shared caches/CloudFront serve a 60s-fresh copy and revalidate
 * in the background — published content changes are picked up promptly while hot
 * paths avoid hitting the DB on every request. Worker cache-purge still flushes
 * the renderer's Redis layer on publish.
 */
const PUBLIC_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/**
 * Public render API (@Public, host-resolved, Redis-cached) consumed by the
 * Next.js renderer. Lives at /api/v1/public/*. The site is resolved server-side
 * from the Host header — a client-supplied siteId is never trusted.
 */
@ApiTags("public-render")
@Controller("public")
export class PublicRenderController {
  constructor(private readonly render: PublicRenderService) {}

  @Public()
  @Get("site")
  @ApiOperation({ summary: "Resolved site + theme tokens + public settings (404 unknown host)" })
  async site(@PublicHost() host: string | undefined, @Res() res: Response): Promise<Response> {
    res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
    return responseUtils.success(res, { data: await this.render.site(host) });
  }

  @Public()
  @Get("page")
  @ApiOperation({
    summary: "Published page layout + seo + schemaVersion by host+path (+ optional ?locale=)",
  })
  async page(
    @PublicHost() host: string | undefined,
    @Query("path") path: string,
    @Query("locale") locale: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
    return responseUtils.success(res, {
      data: await this.render.page(host, path ?? "/", locale || undefined),
    });
  }

  @Public()
  @Get("posts")
  @ApiOperation({ summary: "Published blog post index (optional ?term= slug, ?limit=)" })
  async posts(
    @PublicHost() host: string | undefined,
    @Query("term") term: string | undefined,
    @Query("limit") limit: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
    const n = limit ? Number.parseInt(limit, 10) : 24;
    return responseUtils.success(res, {
      data: await this.render.posts(host, term || undefined, Number.isFinite(n) ? n : 24),
    });
  }

  @Public()
  @Get("posts/:slug")
  @ApiOperation({ summary: "One published blog post (layout + seo + terms) by slug (+ ?locale=)" })
  async post(
    @PublicHost() host: string | undefined,
    @Param("slug") slug: string,
    @Query("locale") locale: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
    return responseUtils.success(res, { data: await this.render.post(host, slug, locale || undefined) });
  }

  @Public()
  @Get("preview/page/:id")
  @ApiOperation({ summary: "Token-gated DRAFT preview of a page (no login; ?token= required)" })
  @ApiQuery({
    name: "token",
    type: String,
    required: true,
    description: "Preview capability token matching the page preview nonce",
  })
  async previewPage(
    @PublicHost() host: string | undefined,
    @Param("id") id: string,
    @Query("token") token: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    // Never cache a token-gated draft preview.
    res.setHeader("Cache-Control", "private, no-store");
    return responseUtils.success(res, { data: await this.render.previewPage(host, id, token) });
  }

  @Public()
  @Get("preview/post/:id")
  @ApiOperation({ summary: "Token-gated DRAFT preview of a blog post (no login; ?token= required)" })
  @ApiQuery({
    name: "token",
    type: String,
    required: true,
    description: "Preview capability token matching the post preview nonce",
  })
  async previewPost(
    @PublicHost() host: string | undefined,
    @Param("id") id: string,
    @Query("token") token: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    res.setHeader("Cache-Control", "private, no-store");
    return responseUtils.success(res, { data: await this.render.previewPost(host, id, token) });
  }

  @Public()
  @Get("navigation")
  @ApiOperation({ summary: "Header/footer navigation trees for the resolved site" })
  async navigation(
    @PublicHost() host: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
    return responseUtils.success(res, { data: await this.render.navigation(host) });
  }

  @Public()
  @Get("redirect")
  @ApiOperation({ summary: "Redirect lookup for a path → { to, status } or null" })
  async redirect(
    @PublicHost() host: string | undefined,
    @Query("path") path: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.render.redirect(host, path ?? "/") });
  }
}
