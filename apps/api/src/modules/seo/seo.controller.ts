import { Controller, Get, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { SeoService } from "./seo.service";

/**
 * Public, host-resolved SEO routes. No auth (@Public). The site is resolved from
 * the Host header by the SiteResolver. These are registered OUTSIDE the global
 * `/api` prefix (see main.ts exclude) so they live at the conventional root.
 */
@ApiTags("seo")
@Controller()
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Public()
  @Get("sitemap.xml")
  @ApiOperation({ summary: "Per-site sitemap.xml (published, non-noindex URLs)" })
  async sitemap(@PublicHost() host: string | undefined, @Res() res: Response): Promise<Response> {
    const xml = await this.seo.sitemap(host);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(StatusCodes.OK).send(xml);
  }

  @Public()
  @Get("robots.txt")
  @ApiOperation({ summary: "Per-site robots.txt" })
  async robots(@PublicHost() host: string | undefined, @Res() res: Response): Promise<Response> {
    const txt = await this.seo.robots(host);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(StatusCodes.OK).send(txt);
  }
}
