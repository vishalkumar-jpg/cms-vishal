import { Body, Controller, Delete, Get, Param, Post, Put, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { WorkflowsService } from "./workflows.service";
import { WorkflowDto, WorkflowStatusDto, WorkflowTestDto } from "./dto/workflows.dto";

/**
 * Workflows / automation (Phase 5). Site-scoped CRUD over workflows + ordered
 * actions, lifecycle (activate/pause), a runs log reader, and a dry-run `test`.
 * Reads + writes are editor+ (@Roles("editor")) — all ScopedRepository-guarded.
 * The trigger hooks + the worker executor live outside the controller.
 */
@ApiTags("workflows")
@Controller("workflows")
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @Roles("editor")
  @ApiOperation({ summary: "List workflows (+ actions + recent run count)" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.workflows.list() });
  }

  @Get(":id")
  @Roles("editor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.workflows.get(id) });
  }

  @Get(":id/runs")
  @Roles("editor")
  @ApiOperation({ summary: "Recent runs for a workflow (status + step log)" })
  async runs(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.workflows.runs(id) });
  }

  @Post()
  @Roles("editor")
  async create(
    @Body() dto: WorkflowDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.workflows.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Put(":id")
  @Roles("editor")
  async update(
    @Param("id") id: string,
    @Body() dto: WorkflowDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.workflows.update(id, dto, user) });
  }

  @Put(":id/status")
  @Roles("editor")
  @ApiOperation({ summary: "Activate or pause a workflow" })
  async setStatus(
    @Param("id") id: string,
    @Body() dto: WorkflowStatusDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.workflows.setStatus(id, dto, user) });
  }

  @Post(":id/test")
  @Roles("editor")
  @ApiOperation({ summary: "Dry-run a workflow against a sample subject (no side effects)" })
  async test(
    @Param("id") id: string,
    @Body() dto: WorkflowTestDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.workflows.test(id, dto.visitorId) });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.workflows.remove(id, user) });
  }
}
