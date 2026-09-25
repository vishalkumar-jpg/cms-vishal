import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { PagesService } from "./pages.service";
import {
  ApproveDto,
  CreatePageDto,
  CreatePageFromTemplateDto,
  CreateTranslationDto,
  ImportPocDto,
  ListPagesQueryDto,
  RejectDto,
  SaveDraftDto,
  SchedulePageDto,
  SubmitReviewDto,
  UpdatePageDto,
} from "./dto/page.dto";
import { TemplateInstantiationService } from "./template-instantiation.service";

/**
 * Pages — builder content for the active site. All routes are tenant-scoped via
 * the X-Site-Id header (TenantGuard). Contributors may edit drafts; only
 * editor+ may publish/schedule/rollback.
 */
@ApiTags("pages")
@Controller("pages")
export class PagesController {
  constructor(
    private readonly pages: PagesService,
    private readonly templateInstantiation: TemplateInstantiationService,
  ) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List pages for the active site" })
  async list(@Query() query: ListPagesQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.list(query) });
  }

  @Post()
  @Roles("contributor")
  @ApiOperation({ summary: "Create a draft page" })
  async create(
    @Body() dto: CreatePageDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.pages.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post("from-template")
  @Roles("contributor")
  @ApiOperation({ summary: "Create a draft page from a published template skeleton" })
  async createFromTemplate(
    @Body() dto: CreatePageFromTemplateDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.templateInstantiation.instantiate(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post("import-poc")
  @Roles("editor")
  @ApiOperation({ summary: "Import a Craft.js POC export as a new draft page" })
  async importPoc(
    @Body() dto: ImportPocDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.pages.importPoc(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.get(id) });
  }

  @Post(":id/duplicate")
  @Roles("contributor")
  @ApiOperation({ summary: "Duplicate a page as a new draft (own slug + translation group)" })
  async duplicate(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.pages.duplicate(id, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  // -- i18n / localization (B13) ---------------------------------------------

  @Get(":id/translations")
  @Roles("contributor")
  @ApiOperation({ summary: "List the sibling-locale translations of a page" })
  async listTranslations(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.listTranslations(id) });
  }

  @Post(":id/translations")
  @Roles("contributor")
  @ApiOperation({ summary: "Create a translation of a page in another locale (clones layout)" })
  async createTranslation(
    @Param("id") id: string,
    @Body() dto: CreateTranslationDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.pages.createTranslation(id, dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":id")
  @Roles("contributor")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.update(id, dto, user) });
  }

  @Patch(":id/draft")
  @Roles("contributor")
  @ApiOperation({ summary: "Autosave the draft layout (optimistic lock via If-Match)" })
  async saveDraft(
    @Param("id") id: string,
    @Body() dto: SaveDraftDto,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.pages.saveDraft(id, dto, user, ifMatch),
    });
  }

  @Post(":id/publish")
  @Roles("editor")
  @ApiOperation({ summary: "Publish the draft (snapshots a version, purges cache)" })
  async publish(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.publish(id, user) });
  }

  @Post(":id/submit-review")
  @Roles("contributor")
  @ApiOperation({ summary: "Submit a draft for review (draft → in_review)" })
  async submitReview(
    @Param("id") id: string,
    @Body() dto: SubmitReviewDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.submitReview(id, dto, user) });
  }

  @Post(":id/approve")
  @Roles("editor")
  @ApiOperation({ summary: "Approve content in review (in_review → approved)" })
  async approve(
    @Param("id") id: string,
    @Body() dto: ApproveDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.approve(id, dto, user) });
  }

  @Post(":id/reject")
  @Roles("editor")
  @ApiOperation({ summary: "Reject content back to the author (in_review → draft)" })
  async reject(
    @Param("id") id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.reject(id, dto, user) });
  }

  @Post(":id/preview-link")
  @Roles("editor")
  @ApiOperation({ summary: "Mint a shareable no-login draft preview link" })
  async createPreviewLink(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.createPreviewLink(id, user) });
  }

  @Delete(":id/preview-link")
  @Roles("editor")
  @ApiOperation({ summary: "Revoke all draft preview links for a page" })
  async revokePreviewLink(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.revokePreviewLink(id, user) });
  }

  @Post(":id/schedule")
  @Roles("editor")
  async schedule(
    @Param("id") id: string,
    @Body() dto: SchedulePageDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.schedule(id, dto, user) });
  }

  @Get(":id/versions")
  @Roles("contributor")
  async versions(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.listVersions(id) });
  }

  @Post(":id/rollback/:versionId")
  @Roles("editor")
  async rollback(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.pages.rollback(id, versionId, user),
    });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.pages.remove(id, user) });
  }
}
