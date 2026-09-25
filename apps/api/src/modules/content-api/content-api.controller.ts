import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Public } from "@common/decorators/public.decorator";
import { ContentApiService, type PageQuery } from "./content-api.service";
import { ContentApiKeyGuard } from "./content-api-key.guard";
import { ContentApiSiteId } from "./content-api-site.decorator";

/**
 * Public, versioned, read-only Content API (E27) under `/api/v1/content`.
 *
 * `@Public` opts out of the cookie/JWT + tenant guards; `ContentApiKeyGuard`
 * authenticates the `Authorization: Bearer <key>` and resolves the site FROM the
 * key (the key is the tenant). Every read is therefore scoped to exactly one
 * site with no cross-tenant surface. Lists are offset-paginated (`?limit&offset`).
 */
@ApiTags("content-api")
@Public()
@UseGuards(ContentApiKeyGuard)
@Controller("content")
export class ContentApiController {
  constructor(private readonly content: ContentApiService) {}

  private parseQuery(limit?: string, offset?: string): PageQuery {
    return {
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
    };
  }

  @Get("pages")
  async listPages(
    @ContentApiSiteId() siteId: string,
    @Query("limit") limit: string,
    @Query("offset") offset: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.content.listPages(siteId, this.parseQuery(limit, offset)),
    });
  }

  @Get("pages/:slug")
  async getPage(
    @ContentApiSiteId() siteId: string,
    @Param("slug") slug: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.content.getPage(siteId, slug) });
  }

  @Get("posts")
  async listPosts(
    @ContentApiSiteId() siteId: string,
    @Query("limit") limit: string,
    @Query("offset") offset: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.content.listPosts(siteId, this.parseQuery(limit, offset)),
    });
  }

  @Get("posts/:slug")
  async getPost(
    @ContentApiSiteId() siteId: string,
    @Param("slug") slug: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.content.getPost(siteId, slug) });
  }

  @Get("collections/:slug/items")
  async listCollectionItems(
    @ContentApiSiteId() siteId: string,
    @Param("slug") slug: string,
    @Query("limit") limit: string,
    @Query("offset") offset: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.content.listCollectionItems(siteId, slug, this.parseQuery(limit, offset)),
    });
  }

  @Get("collections/:slug/items/:itemSlug")
  async getCollectionItem(
    @ContentApiSiteId() siteId: string,
    @Param("slug") slug: string,
    @Param("itemSlug") itemSlug: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.content.getCollectionItem(siteId, slug, itemSlug),
    });
  }

  @Get("media")
  async listMedia(
    @ContentApiSiteId() siteId: string,
    @Query("limit") limit: string,
    @Query("offset") offset: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.content.listMedia(siteId, this.parseQuery(limit, offset)),
    });
  }
}
