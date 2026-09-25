import { Body, Controller, Get, Param, Put, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { NavigationService } from "./navigation.service";
import { UpsertNavigationDto } from "./dto/navigation.dto";

@ApiTags("navigation")
@Controller("navigation")
export class NavigationController {
  constructor(private readonly nav: NavigationService) {}

  @Get()
  @Roles("contributor")
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.nav.list() });
  }

  @Get(":location")
  @Roles("contributor")
  async get(@Param("location") location: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.nav.get(location) });
  }

  @Put(":location")
  @Roles("editor")
  @ApiOperation({ summary: "Create or replace the menu for a location" })
  async upsert(
    @Param("location") location: string,
    @Body() dto: UpsertNavigationDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.nav.upsert(location, dto, user) });
  }
}
