import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { ExperimentsService } from "./experiments.service";
import { ExperimentDto, ExperimentStatusDto } from "./dto/experiments.dto";

/**
 * Experiments (Phase 4 A/B). Site-scoped CRUD over experiments + weighted
 * variants, lifecycle (start/pause/stop), and an on-read results rollup. Reads
 * are contributor+, writes editor+ — all ScopedRepository-guarded. Two @Public,
 * host-resolved endpoints serve the renderer: variant defs (for deterministic
 * assignment) + a personalization audience resolve.
 */
@ApiTags("experiments")
@Controller("experiments")
export class ExperimentsController {
  constructor(private readonly experiments: ExperimentsService) {}

  // --- Public (host-resolved) -----------------------------------------------

  @Public()
  @Get("public/:id")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "experiment-public" })
  @ApiOperation({ summary: "Variant keys/weights/status for the renderer block" })
  async publicExperiment(
    @PublicHost() host: string | undefined,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.experiments.publicExperiment(host, id);
    return responseUtils.success(res, { data });
  }

  @Public()
  @Get("personalize/audiences")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "personalize" })
  @ApiOperation({ summary: "Resolve a visitor's audience ids (visibleIf: audience)" })
  async personalize(
    @PublicHost() host: string | undefined,
    @Query("visitorId") visitorId: string,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.experiments.personalize(host, visitorId ?? "");
    return responseUtils.success(res, { data });
  }

  // --- Site-scoped CRUD -----------------------------------------------------

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List experiments (+ variants)" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.experiments.list() });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.experiments.get(id) });
  }

  @Get(":id/results")
  @Roles("contributor")
  @ApiOperation({ summary: "Per-variant exposures/conversions/rate + leader" })
  async results(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.experiments.results(id) });
  }

  @Post()
  @Roles("editor")
  async create(
    @Body() dto: ExperimentDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.experiments.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Put(":id")
  @Roles("editor")
  async update(
    @Param("id") id: string,
    @Body() dto: ExperimentDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.experiments.update(id, dto, user) });
  }

  @Put(":id/status")
  @Roles("editor")
  @ApiOperation({ summary: "Start / pause / stop (running|paused|done) an experiment" })
  async setStatus(
    @Param("id") id: string,
    @Body() dto: ExperimentStatusDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.experiments.setStatus(id, dto, user) });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.experiments.remove(id, user) });
  }
}
