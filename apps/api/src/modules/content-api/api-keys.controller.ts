import { Body, Controller, Delete, Get, Param, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/api-key.dto";

/**
 * Admin management of Content-API keys (E27). Site-scoped + audited; requires
 * site_admin. The create response contains the plaintext key ONCE.
 */
@ApiTags("api-keys")
@Controller("api-keys")
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  @Roles("site_admin")
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.keys.list() });
  }

  @Post()
  @Roles("site_admin")
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.keys.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Delete(":id")
  @Roles("site_admin")
  async revoke(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.keys.revoke(id, user) });
  }
}
