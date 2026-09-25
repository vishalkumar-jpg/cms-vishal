import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { SearchService } from "./search.service";

/**
 * Global content search for the active site (X-Site-Id). Powers the admin
 * ⌘K command palette. Site-scoped via ScopedRepository — never cross-tenant.
 */
@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({
    summary: "Search pages/posts/media/collections/forms for the active site",
  })
  async query(
    @Query("q") q: string,
    @Query("types") types: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.search.search(q ?? "", types) });
  }
}
