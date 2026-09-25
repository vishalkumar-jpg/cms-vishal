import { Body, Controller, Get, Patch, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { ThemesService } from "./themes.service";
import { UpdateThemeDto } from "./dto/theme.dto";

@ApiTags("themes")
@Controller("theme")
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Get()
  @Roles("contributor")
  async get(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.themes.get() });
  }

  @Patch()
  @Roles("site_admin")
  async update(
    @Body() dto: UpdateThemeDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.themes.update(dto, user) });
  }
}
