import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { PlatformAdmin } from "@common/decorators/platform-admin.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { TemplateSkeletonAssetsService } from "./template-skeleton-assets.service";
import { TemplateSkeletonUsageService } from "./template-skeleton-usage.service";
import { TemplateSkeletonVersionService } from "./template-skeleton-version.service";
import { TemplateSkeletonsService } from "./template-skeletons.service";
import { ListTemplateSkeletonsQueryDto } from "./dto/template-skeleton.dto";
import { TopTemplateUsageQueryDto } from "./dto/template-skeleton-usage.dto";

/**
 * Template skeleton catalog API — cross-tenant registry rows (not site-scoped storage).
 *
 * Read routes require `@Roles("contributor")` on the active site (`X-Site-Id`).
 * Platform admins may read without a site header. Mutations require `@PlatformAdmin()`.
 */
@ApiTags("template-skeletons")
@Controller("template-skeletons")
export class TemplateSkeletonsController {
  constructor(
    private readonly skeletons: TemplateSkeletonsService,
    private readonly skeletonVersions: TemplateSkeletonVersionService,
    private readonly skeletonUsage: TemplateSkeletonUsageService,
    private readonly assets: TemplateSkeletonAssetsService,
  ) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List template skeletons (catalog filters)" })
  async list(
    @Query() query: ListTemplateSkeletonsQueryDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.skeletons.list(query) });
  }

  @Get("by-key/:templateKey")
  @Roles("contributor")
  @ApiOperation({ summary: "Fetch a template skeleton by stable registry key" })
  async getByKey(
    @Param("templateKey") templateKey: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.skeletons.getByKey(templateKey),
    });
  }

  @Get("analytics/top")
  @Roles("contributor")
  @ApiOperation({ summary: "Most-used starter templates on the active site" })
  async getTopUsage(
    @Query() query: TopTemplateUsageQueryDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.skeletonUsage.getTopTemplates(query.limit),
    });
  }

  @Get(":id/history")
  @Roles("contributor")
  @ApiOperation({ summary: "List immutable version snapshots for a template skeleton" })
  async listHistory(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.skeletonVersions.listHistory(id),
    });
  }

  @Get(":id/history/:version")
  @Roles("contributor")
  @ApiOperation({ summary: "Fetch a specific template skeleton version snapshot" })
  async getHistoryVersion(
    @Param("id") id: string,
    @Param("version") version: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.skeletonVersions.getVersion(id, version),
    });
  }

  @Get(":id/usage")
  @Roles("contributor")
  @ApiOperation({ summary: "Template usage analytics for a starter skeleton" })
  async getUsage(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.skeletonUsage.getUsageBySkeletonId(id),
    });
  }

  @Get(":id")
  @Roles("contributor")
  @ApiOperation({ summary: "Fetch a template skeleton by id" })
  async getById(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.skeletons.getById(id) });
  }

  @Post()
  @PlatformAdmin()
  @ApiOperation({ summary: "Create a template skeleton (platform admin only)" })
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.skeletons.create(body, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":id")
  @PlatformAdmin()
  @ApiOperation({ summary: "Update template skeleton metadata and/or content" })
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.skeletons.update(id, body, user),
    });
  }

  @Delete(":id")
  @PlatformAdmin()
  @ApiOperation({ summary: "Soft-delete a template skeleton" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.skeletons.remove(id, user) });
  }

  // -- preview assets --------------------------------------------------------

  @Get(":id/assets")
  @Roles("contributor")
  @ApiOperation({ summary: "List preview assets for a template skeleton" })
  async listAssets(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.assets.list(id) });
  }

  @Post(":id/assets")
  @PlatformAdmin()
  @ApiOperation({ summary: "Attach a preview asset reference to a skeleton" })
  async createAsset(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.assets.create(id, body, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":id/assets/:assetId")
  @PlatformAdmin()
  @ApiOperation({ summary: "Update a preview asset reference" })
  async updateAsset(
    @Param("id") id: string,
    @Param("assetId") assetId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.assets.update(id, assetId, body, user),
    });
  }

  @Delete(":id/assets/:assetId")
  @PlatformAdmin()
  @ApiOperation({ summary: "Remove a preview asset reference" })
  async removeAsset(
    @Param("id") id: string,
    @Param("assetId") assetId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.assets.remove(id, assetId, user),
    });
  }
}
