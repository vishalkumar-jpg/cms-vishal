import { Body, Controller, Delete, Get, Param, Post, Put, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { AudiencesService } from "./audiences.service";
import { AudienceDto, AudiencePreviewDto } from "./dto/audiences.dto";

/**
 * Audiences (Phase 3). Site-scoped CRUD over audience definitions + a live
 * preview count + a materialized member list (recompute runs in the worker).
 * Reads are contributor+, writes editor+. All ScopedRepository-guarded.
 */
@ApiTags("audiences")
@Controller("audiences")
export class AudiencesController {
  constructor(private readonly audiences: AudiencesService) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List audience definitions (+ member counts)" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.audiences.list() });
  }

  @Post("preview")
  @Roles("contributor")
  @ApiOperation({ summary: "Match count for a rule set (no persistence)" })
  async preview(@Body() dto: AudiencePreviewDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.audiences.preview(dto) });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.audiences.get(id) });
  }

  @Get(":id/members")
  @Roles("contributor")
  @ApiOperation({ summary: "Materialized members of an audience" })
  async members(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.audiences.members(id) });
  }

  @Post()
  @Roles("editor")
  async create(
    @Body() dto: AudienceDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.audiences.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Put(":id")
  @Roles("editor")
  async update(
    @Param("id") id: string,
    @Body() dto: AudienceDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.audiences.update(id, dto, user) });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.audiences.remove(id, user) });
  }

  @Post(":id/recompute")
  @Roles("editor")
  @ApiOperation({ summary: "Enqueue a membership recompute for this audience" })
  async recompute(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.audiences.recompute(id, user),
      status: StatusCodes.ACCEPTED,
    });
  }
}
