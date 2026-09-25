import { Body, Controller, Get, Put, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { SiteChromeService } from "./site-chrome.service";
import { UpdateSiteChromeDto } from "./dto/site-chrome.dto";

/**
 * Site chrome (GLOBAL-CHROME) — the active site's ONE global header + ONE global
 * footer. Tenant-scoped via the X-Site-Id header (TenantGuard). editor+ may edit.
 * The admin "Header & Footer" builder reads GET and autosaves PUT.
 */
@ApiTags("site-chrome")
@Controller("site-chrome")
export class SiteChromeController {
  constructor(private readonly chrome: SiteChromeService) {}

  @Get()
  @Roles("editor")
  @ApiOperation({ summary: "Get the active site's global header + footer layouts" })
  async get(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.chrome.get() });
  }

  @Put()
  @Roles("editor")
  @ApiOperation({ summary: "Save the global header and/or footer (save = live; purges cache)" })
  async update(
    @Body() dto: UpdateSiteChromeDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.chrome.update(dto, user) });
  }
}
