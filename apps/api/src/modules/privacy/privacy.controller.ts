import { Controller, Delete, Get, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { PrivacyService } from "./privacy.service";
import { SubjectQueryDto } from "./dto/privacy.dto";

/**
 * DSAR (Data Subject Access Request) — the site_admin surface for GDPR access +
 * erasure requests. Tenant-scoped via the X-Site-Id header (TenantGuard →
 * ScopedRepository), so a request only ever sees/erases the active site's rows.
 * Every erasure is audited (privacy.dsar_erased).
 *
 *   GET    /privacy/subject?query=<email|visitorId>          → data summary
 *   GET    /privacy/subject/export?query=<email|visitorId>   → full JSON export
 *   DELETE /privacy/subject?query=<email|visitorId>          → erase/anonymize
 */
@ApiTags("privacy")
@Controller("privacy")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get("subject")
  @Roles("site_admin")
  @ApiOperation({ summary: "Summary of all data held for an email or visitorId (counts + identity)" })
  async summary(@Query() q: SubjectQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.privacy.summary(q.query) });
  }

  @Get("subject/export")
  @Roles("site_admin")
  @ApiOperation({ summary: "Full JSON export of every row held across all tables" })
  async export(@Query() q: SubjectQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.privacy.export(q.query) });
  }

  @Delete("subject")
  @Roles("site_admin")
  @ApiOperation({ summary: "Erase / anonymize all data for an email or visitorId (audited)" })
  async erase(
    @Query() q: SubjectQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.privacy.erase(q.query, user) });
  }
}
