import { Body, Controller, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { HubspotImportService } from "./hubspot-import.service";
import {
  HubspotPreviewDto,
  HubspotRunDto,
  HubspotRunExportDto,
} from "./dto/hubspot-import.dto";

/**
 * HubSpot migration (backlog #28). Site-scoped via the X-Site-Id header
 * (TenantGuard); site_admin only. The private-app token is accepted per request
 * and never persisted. Errors (bad token, network) come back as clean 400s.
 */
@ApiTags("hubspot-import")
@Controller("hubspot-import")
export class HubspotImportController {
  constructor(private readonly hubspot: HubspotImportService) {}

  @Post("preview")
  @Roles("site_admin")
  @ApiOperation({ summary: "List a tenant's HubSpot CMS pages + blog posts to import" })
  async preview(@Body() dto: HubspotPreviewDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.hubspot.preview(dto.token) });
  }

  @Post("run")
  @Roles("site_admin")
  @ApiOperation({ summary: "Import selected HubSpot pages/posts as OB-CMS drafts" })
  async run(
    @Body() dto: HubspotRunDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.hubspot.run(dto, user) });
  }

  @Post("run-export")
  @Roles("site_admin")
  @ApiOperation({ summary: "Offline import from an uploaded HubSpot export JSON (no live token)" })
  async runExport(
    @Body() dto: HubspotRunExportDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.hubspot.runExport(dto, user) });
  }
}
