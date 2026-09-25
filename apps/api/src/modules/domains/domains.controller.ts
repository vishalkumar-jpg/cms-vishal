import { Body, Controller, Delete, Get, Param, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { DomainsService } from "./domains.service";
import { CreateDomainDto } from "./dto/domain.dto";

/**
 * Custom-domain binding for the active site (X-Site-Id scoped). Reads are open
 * to contributors; all mutations require site_admin.
 */
@ApiTags("domains")
@Controller("domains")
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @Roles("contributor")
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.domains.list() });
  }

  @Post()
  @Roles("site_admin")
  @ApiOperation({ summary: "Add a custom domain; returns DNS setup instructions" })
  async create(
    @Body() dto: CreateDomainDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.domains.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post(":id/verify")
  @Roles("site_admin")
  @ApiOperation({ summary: "Run a DNS TXT lookup to verify ownership; kicks TLS" })
  async verify(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.domains.verify(id, user) });
  }

  @Post(":id/primary")
  @Roles("site_admin")
  @ApiOperation({ summary: "Set this verified domain as the site's primary host" })
  async setPrimary(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.domains.setPrimary(id, user) });
  }

  @Post(":id/ssl-check")
  @Roles("site_admin")
  @ApiOperation({ summary: "Trigger an on-demand SSL/cert-expiry re-check for this domain" })
  async sslCheck(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.domains.sslCheck(id, user),
      status: StatusCodes.ACCEPTED,
    });
  }

  @Delete(":id")
  @Roles("site_admin")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.domains.remove(id, user) });
  }
}
