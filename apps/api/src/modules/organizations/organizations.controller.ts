import { Body, Controller, Get, Param, Patch, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto, UpdateOrganizationDto } from "./dto/organization.dto";

/** Platform-level org management — super_admin only (no per-site context). */
@ApiTags("organizations")
@Controller("organizations")
@Roles("super_admin")
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: "Create an organization (tenant grouping)" })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.orgs.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get()
  @ApiOperation({ summary: "List organizations" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.orgs.list() });
  }

  @Get(":id")
  async get(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.orgs.get(id) });
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.orgs.update(id, dto, user) });
  }
}
