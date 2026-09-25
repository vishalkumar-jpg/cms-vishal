import { Body, Controller, Delete, Get, Param, Post, Put, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { ReusableBlocksService } from "./reusable-blocks.service";
import {
  CreateReusableBlockDto,
  UpdateReusableBlockDto,
} from "./dto/reusable-blocks.dto";

/**
 * REUSE-BLOCKS — the active site's named reusable blocks. Tenant-scoped via the
 * X-Site-Id header (TenantGuard). editor+ may manage. Saving a block purges the
 * site's render cache so every `ReusableBlock` instance re-resolves the source
 * ("edit once, update everywhere").
 */
@ApiTags("reusable-blocks")
@Controller("reusable-blocks")
export class ReusableBlocksController {
  constructor(private readonly blocks: ReusableBlocksService) {}

  @Get()
  @Roles("editor")
  @ApiOperation({ summary: "List the active site's reusable blocks" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.blocks.list() });
  }

  @Get(":id")
  @Roles("editor")
  @ApiOperation({ summary: "Get one reusable block (with its layout)" })
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.blocks.get(id) });
  }

  @Post()
  @Roles("editor")
  @ApiOperation({ summary: "Create a reusable block from a serialized fragment" })
  async create(
    @Body() dto: CreateReusableBlockDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.blocks.create(dto, user),
      status: StatusCodes.CREATED,
    });
  }

  @Put(":id")
  @Roles("editor")
  @ApiOperation({ summary: "Update a reusable block (save = live; purges cache)" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateReusableBlockDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blocks.update(id, dto, user) });
  }

  @Delete(":id")
  @Roles("editor")
  @ApiOperation({ summary: "Delete a reusable block" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blocks.remove(id, user) });
  }
}
