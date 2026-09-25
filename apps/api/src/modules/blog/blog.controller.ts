import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { BlogService } from "./blog.service";
import {
  ApproveDto,
  BulkPostsDto,
  CreatePostDto,
  CreateTranslationDto,
  ListPostsQueryDto,
  ListTermsQueryDto,
  RejectDto,
  SavePostLayoutDto,
  SchedulePostDto,
  SubmitReviewDto,
  TermDto,
  UpdatePostDto,
  UpdateTermDto,
} from "./dto/post.dto";

@ApiTags("blog")
@Controller("posts")
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @Roles("contributor")
  async list(@Query() query: ListPostsQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.list(query) });
  }

  // -- taxonomy (declared before :id so "terms" isn't captured as an id) -------

  @Get("terms")
  @Roles("contributor")
  @ApiOperation({ summary: "List distinct categories/tags with usage counts" })
  async listTerms(@Query() query: ListTermsQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.listTerms(query) });
  }

  @Post("terms")
  @Roles("editor")
  @ApiOperation({ summary: "Create a standalone category/tag" })
  async createTerm(
    @Body() dto: TermDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.blog.createTerm(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch("terms/:kind/:slug")
  @Roles("editor")
  @ApiOperation({ summary: "Rename a category/tag everywhere it is used" })
  async updateTerm(
    @Param("kind") kind: string,
    @Param("slug") slug: string,
    @Body() dto: UpdateTermDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.blog.updateTerm(kind, slug, dto.name, user),
    });
  }

  @Delete("terms/:kind/:slug")
  @Roles("editor")
  @ApiOperation({ summary: "Delete a category/tag from every post" })
  async deleteTerm(
    @Param("kind") kind: string,
    @Param("slug") slug: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.deleteTerm(kind, slug, user) });
  }

  // -- bulk -------------------------------------------------------------------

  @Post("bulk/publish")
  @Roles("editor")
  async bulkPublish(
    @Body() dto: BulkPostsDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.bulkPublish(dto, user) });
  }

  @Post("bulk/trash")
  @Roles("editor")
  async bulkTrash(
    @Body() dto: BulkPostsDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.bulkTrash(dto, user) });
  }

  @Post("bulk/restore")
  @Roles("editor")
  async bulkRestore(
    @Body() dto: BulkPostsDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.bulkRestore(dto, user) });
  }

  // -- single post ------------------------------------------------------------

  @Post()
  @Roles("contributor")
  async create(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.blog.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.get(id) });
  }

  // -- i18n / localization (B13) ---------------------------------------------

  @Get(":id/translations")
  @Roles("contributor")
  @ApiOperation({ summary: "List the sibling-locale translations of a post" })
  async listTranslations(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.listTranslations(id) });
  }

  @Post(":id/translations")
  @Roles("contributor")
  @ApiOperation({ summary: "Create a translation of a post in another locale (clones body)" })
  async createTranslation(
    @Param("id") id: string,
    @Body() dto: CreateTranslationDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.blog.createTranslation(id, dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":id")
  @Roles("contributor")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.update(id, dto, user) });
  }

  @Put(":id/layout")
  @Roles("contributor")
  @ApiOperation({ summary: "Autosave the visual-builder draft layout for a post" })
  async saveLayout(
    @Param("id") id: string,
    @Body() dto: SavePostLayoutDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.saveLayout(id, dto, user) });
  }

  @Post(":id/publish")
  @Roles("editor")
  async publish(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.publish(id, user) });
  }

  @Post(":id/submit-review")
  @Roles("contributor")
  @ApiOperation({ summary: "Submit a draft post for review (draft → in_review)" })
  async submitReview(
    @Param("id") id: string,
    @Body() dto: SubmitReviewDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.submitReview(id, dto, user) });
  }

  @Post(":id/approve")
  @Roles("editor")
  @ApiOperation({ summary: "Approve a post in review (in_review → approved)" })
  async approve(
    @Param("id") id: string,
    @Body() dto: ApproveDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.approve(id, dto, user) });
  }

  @Post(":id/reject")
  @Roles("editor")
  @ApiOperation({ summary: "Reject a post back to the author (in_review → draft)" })
  async reject(
    @Param("id") id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.reject(id, dto, user) });
  }

  @Post(":id/schedule")
  @Roles("editor")
  async schedule(
    @Param("id") id: string,
    @Body() dto: SchedulePostDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.schedule(id, dto, user) });
  }

  @Post(":id/preview-link")
  @Roles("editor")
  @ApiOperation({ summary: "Mint a shareable no-login draft preview link" })
  async createPreviewLink(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.createPreviewLink(id, user) });
  }

  @Delete(":id/preview-link")
  @Roles("editor")
  @ApiOperation({ summary: "Revoke all draft preview links for a post" })
  async revokePreviewLink(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.revokePreviewLink(id, user) });
  }

  @Post(":id/restore")
  @Roles("editor")
  @ApiOperation({ summary: "Restore a trashed post" })
  async restore(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.restore(id, user) });
  }

  @Delete(":id")
  @Roles("editor")
  @ApiOperation({ summary: "Move a post to trash (soft delete)" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.remove(id, user) });
  }

  @Delete(":id/permanent")
  @Roles("editor")
  @ApiOperation({ summary: "Permanently delete a trashed post" })
  async destroy(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blog.destroy(id, user) });
  }
}
