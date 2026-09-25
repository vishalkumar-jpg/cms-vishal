import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { MediaService } from "./media.service";
import {
  ConfirmUploadDto,
  CreateFolderDto,
  CropMediaDto,
  ListMediaQueryDto,
  MoveMediaDto,
  PresignUploadDto,
  UpdateFolderDto,
  UpdateMediaDto,
} from "./dto/media.dto";

@ApiTags("media")
@Controller("media")
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post("presign")
  @Roles("contributor")
  @ApiOperation({ summary: "Reserve a media row + presigned upload URL" })
  async presign(
    @Body() dto: PresignUploadDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.mediaService.presign(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post("confirm")
  @Roles("contributor")
  @ApiOperation({ summary: "Confirm an upload completed (enqueues processing)" })
  async confirm(
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.confirm(dto, user) });
  }

  @Get()
  @Roles("contributor")
  async list(@Query() query: ListMediaQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.list(query) });
  }

  @Get("export.csv")
  @Roles("editor")
  @ApiOperation({ summary: "Export the media library as CSV (formula-injection-safe)" })
  async exportCsv(@Res() res: Response): Promise<Response> {
    const csv = await this.mediaService.exportCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="media.csv"');
    return res.status(StatusCodes.OK).send(csv);
  }

  // --- Folders (static paths declared BEFORE ":id" so they don't get shadowed) -

  @Get("folders")
  @Roles("contributor")
  @ApiOperation({ summary: "List the site's media folders (tree)" })
  async listFolders(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.listFolders() });
  }

  @Post("folders")
  @Roles("contributor")
  @ApiOperation({ summary: "Create a media folder" })
  async createFolder(
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.mediaService.createFolder(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch("folders/:id")
  @Roles("contributor")
  @ApiOperation({ summary: "Rename / re-parent a folder" })
  async updateFolder(
    @Param("id") id: string,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.updateFolder(id, dto, user) });
  }

  @Delete("folders/:id")
  @Roles("editor")
  @ApiOperation({ summary: "Delete a folder (children re-parent, assets → root)" })
  async deleteFolder(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.deleteFolder(id, user) });
  }

  @Post("move")
  @Roles("contributor")
  @ApiOperation({ summary: "Move assets into a folder (null = root)" })
  async move(
    @Body() dto: MoveMediaDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.move(dto, user) });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.get(id) });
  }

  @Get(":id/usage")
  @Roles("contributor")
  @ApiOperation({ summary: "Where-used: pages/posts/collections referencing this asset" })
  async usage(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.usage(id) });
  }

  @Post(":id/crop")
  @Roles("contributor")
  @ApiOperation({ summary: "Server-side crop (enqueues a derivative + re-derive)" })
  async crop(
    @Param("id") id: string,
    @Body() dto: CropMediaDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.crop(id, dto, user) });
  }

  @Patch(":id")
  @Roles("contributor")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.update(id, dto, user) });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.mediaService.remove(id, user) });
  }
}
