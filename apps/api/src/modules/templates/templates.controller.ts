import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { TemplatesService } from "./templates.service";
import { CreateTemplateDto, ListTemplatesQueryDto, UpdateTemplateDto } from "./dto/template.dto";

@ApiTags("templates")
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List the site's templates + global presets" })
  async list(@Query() query: ListTemplatesQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.templates.list(query) });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.templates.get(id) });
  }

  @Post()
  @Roles("editor")
  @ApiOperation({ summary: "Save a new template owned by the active site" })
  async create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.templates.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":id")
  @Roles("editor")
  @ApiOperation({ summary: "Rename a site-owned template" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.templates.update(id, dto, user) });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.templates.remove(id, user) });
  }
}
