import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { RedirectsService } from "./redirects.service";
import {
  CreateRedirectDto,
  ImportRedirectsDto,
  UpdateRedirectDto,
} from "./dto/redirect.dto";

@ApiTags("redirects")
@Controller("redirects")
export class RedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get()
  @Roles("contributor")
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.redirects.list() });
  }

  @Post()
  @Roles("editor")
  async create(
    @Body() dto: CreateRedirectDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.redirects.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post("import")
  @Roles("editor")
  @ApiOperation({ summary: "Bulk import redirects from CSV (loop-safe)" })
  async importCsv(
    @Body() dto: ImportRedirectsDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.redirects.importCsv(dto.csv, user) });
  }

  @Patch(":id")
  @Roles("editor")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateRedirectDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.redirects.update(id, dto, user) });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.redirects.remove(id, user) });
  }
}
