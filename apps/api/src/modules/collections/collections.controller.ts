import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { CollectionsService } from "./collections.service";
import {
  CreateCollectionDto,
  CreateCollectionItemDto,
  ListItemsQueryDto,
  UpdateCollectionDto,
  UpdateCollectionDetailLayoutDto,
  UpdateCollectionItemDto,
} from "./dto/collection.dto";

/**
 * Admin collections surface (site-scoped via X-Site-Id + ScopedRepository).
 * Marketers define a collection's field schema, then CRUD its items with a
 * draft/published lifecycle. The public render surface lives in
 * PublicCollectionsController.
 */
@ApiTags("collections")
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  // -- collections -----------------------------------------------------------

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List collections for the active site" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.collections.list() });
  }

  @Post()
  @Roles("editor")
  @ApiOperation({ summary: "Create a collection (with its field schema)" })
  async create(
    @Body() dto: CreateCollectionDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.collections.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.collections.get(id) });
  }

  @Put(":id")
  @Roles("editor")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.collections.update(id, dto, user) });
  }

  @Patch(":id/detail-layout")
  @Roles("editor")
  @ApiOperation({ summary: "Save the collection detail layout only (visual builder autosave)" })
  async saveDetailLayout(
    @Param("id") id: string,
    @Body() dto: UpdateCollectionDetailLayoutDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.collections.saveDetailLayout(id, dto, user),
    });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.collections.remove(id, user) });
  }

  // -- items -----------------------------------------------------------------

  @Get(":id/items")
  @Roles("contributor")
  @ApiOperation({ summary: "List a collection's items (filter/paginate/sort)" })
  async listItems(
    @Param("id") id: string,
    @Query() query: ListItemsQueryDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.collections.listItems(id, query) });
  }

  @Post(":id/items")
  @Roles("contributor")
  @ApiOperation({ summary: "Create a draft item" })
  async createItem(
    @Param("id") id: string,
    @Body() dto: CreateCollectionItemDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.collections.createItem(id, dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get(":id/items/:itemId")
  @Roles("contributor")
  async getItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.collections.getItem(id, itemId) });
  }

  @Put(":id/items/:itemId")
  @Roles("contributor")
  async updateItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCollectionItemDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.collections.updateItem(id, itemId, dto, user),
    });
  }

  @Post(":id/items/:itemId/publish")
  @Roles("editor")
  @ApiOperation({ summary: "Publish an item (contributor → 403)" })
  async publishItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.collections.publishItem(id, itemId, user),
    });
  }

  @Post(":id/items/:itemId/unpublish")
  @Roles("editor")
  @ApiOperation({ summary: "Revert an item to draft" })
  async unpublishItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.collections.unpublishItem(id, itemId, user),
    });
  }

  @Delete(":id/items/:itemId")
  @Roles("editor")
  async removeItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.collections.removeItem(id, itemId, user),
    });
  }
}
