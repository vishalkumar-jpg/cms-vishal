import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { PublicCollectionsService } from "./public-collections.service";

const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/**
 * PUBLIC collections surface (@Public, host-resolved). Lives at
 * /api/v1/public/collections/*. The site is resolved SERVER-SIDE from the Host
 * header; only published items are served (else 404, no existence leak).
 */
@ApiTags("public-collections")
@Controller("public/collections")
export class PublicCollectionsController {
  constructor(private readonly collections: PublicCollectionsService) {}

  @Public()
  @Get(":slug/items")
  @ApiOperation({ summary: "Published items of a collection (limit/sort)" })
  async listItems(
    @Param("slug") slug: string,
    @PublicHost() host: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("sort") sort: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
    const data = await this.collections.listItems(host, slug, {
      limit: limit ? Number(limit) : undefined,
      sort,
    });
    return responseUtils.success(res, { data });
  }

  @Public()
  @Get(":slug/items/:itemSlug")
  @ApiOperation({ summary: "A single published item by collection + item slug" })
  async getItem(
    @Param("slug") slug: string,
    @Param("itemSlug") itemSlug: string,
    @PublicHost() host: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    res.setHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
    const data = await this.collections.getItem(host, slug, itemSlug);
    return responseUtils.success(res, { data });
  }
}
