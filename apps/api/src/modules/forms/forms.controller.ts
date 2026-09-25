import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { FormsService } from "./forms.service";
import {
  AnalyticsQueryDto,
  CreateFormDto,
  CrmConfigDto,
  ListSubmissionsQueryDto,
  TriageSubmissionDto,
  UpdateFormDto,
} from "./dto/form.dto";

/**
 * Forms admin API — tenant-scoped via X-Site-Id (TenantGuard + ScopedRepository).
 * contributors may author drafts + read submissions; editor+ may publish/delete/
 * export/resend; site_admin+ manages the CRM endpoint/secret/dual-write config.
 */
@ApiTags("forms")
@Controller("forms")
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List forms for the active site" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.list() });
  }

  @Post()
  @Roles("contributor")
  @ApiOperation({ summary: "Create a draft form" })
  async create(
    @Body() dto: CreateFormDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.forms.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  // --- CRM config (site_admin+). Declared before :id to avoid route capture. ---

  @Get("crm-config")
  @Roles("site_admin")
  @ApiOperation({ summary: "Get CRM delivery config (secret never returned)" })
  async getCrmConfig(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.getCrmConfig() });
  }

  @Put("crm-config")
  @Roles("site_admin")
  @ApiOperation({ summary: "Set CRM endpoint/secret/dual-write (secret write-only)" })
  async setCrmConfig(
    @Body() dto: CrmConfigDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.setCrmConfig(dto, user) });
  }

  // --- submission detail + resend (id is a submission id) ---

  @Get("submissions/:sid")
  @Roles("contributor")
  @ApiOperation({ summary: "Submission detail + delivery status" })
  async getSubmission(@Param("sid") sid: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.getSubmission(sid) });
  }

  @Patch("submissions/:sid/triage")
  @Roles("editor")
  @ApiOperation({ summary: "Triage a submission — mark spam/not-spam, read/unread (audited)" })
  async triage(
    @Param("sid") sid: string,
    @Body() dto: TriageSubmissionDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.triage(sid, dto, user) });
  }

  @Post("submissions/:sid/resend")
  @Roles("editor")
  @ApiOperation({ summary: "Re-enqueue CRM delivery for a submission" })
  async resend(
    @Param("sid") sid: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.resend(sid, user) });
  }

  @Get(":id")
  @Roles("contributor")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.get(id) });
  }

  @Patch(":id")
  @Roles("editor")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateFormDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.update(id, dto, user) });
  }

  @Post(":id/publish")
  @Roles("editor")
  @ApiOperation({ summary: "Publish a form (contributor → 403)" })
  async publish(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.publish(id, user) });
  }

  @Delete(":id")
  @Roles("editor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.remove(id, user) });
  }

  @Get(":id/submissions")
  @Roles("contributor")
  @ApiOperation({ summary: "List a form's submissions (paginated, newest first)" })
  async listSubmissions(
    @Param("id") id: string,
    @Query() query: ListSubmissionsQueryDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.listSubmissions(id, query) });
  }

  @Get(":id/analytics")
  @Roles("contributor")
  @ApiOperation({ summary: "Submission analytics — totals, daily series, conversion, recent" })
  async analytics(
    @Param("id") id: string,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.analytics(id, query.days) });
  }

  @Get(":id/submissions/export")
  @Roles("editor")
  @ApiOperation({ summary: "CSV export of a form's submissions (formula-injection-safe)" })
  async exportCsv(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    const csv = await this.forms.exportCsv(id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="submissions-${id}.csv"`);
    return res.status(StatusCodes.OK).send(csv);
  }
}
