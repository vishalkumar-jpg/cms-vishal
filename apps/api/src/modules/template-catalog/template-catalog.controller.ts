import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { TemplateCatalogService } from "./template-catalog.service";
import { ListTemplateCatalogQueryDto } from "./dto/template-catalog.dto";

/**
 * Template catalog browse API — read-only projection over skeleton metadata.
 *
 * Read routes require `@Roles("contributor")` on the active site (`X-Site-Id`).
 * Platform admins may read without a site header.
 */
@ApiTags("template-catalog")
@Controller("template-catalog")
export class TemplateCatalogController {
  constructor(private readonly catalog: TemplateCatalogService) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List template catalog entries (browse filters)" })
  async list(
    @Query() query: ListTemplateCatalogQueryDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.catalog.list(query) });
  }

  @Get("by-key/:templateKey")
  @Roles("contributor")
  @ApiOperation({ summary: "Fetch a template catalog entry by stable registry key" })
  async getByKey(
    @Param("templateKey") templateKey: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.catalog.getByKey(templateKey),
    });
  }

  @Get(":id")
  @Roles("contributor")
  @ApiOperation({ summary: "Fetch a template catalog entry by id" })
  async getById(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.catalog.getById(id) });
  }
}
