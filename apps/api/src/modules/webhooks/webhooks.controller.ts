import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { WebhooksService } from "./webhooks.service";
import { CreateWebhookDto, UpdateWebhookDto } from "./dto/webhook.dto";

/**
 * Admin management of webhook subscriptions (E27). Site-scoped + audited;
 * requires site_admin. Includes a "send test event" endpoint that exercises the
 * full signed-delivery path (worker POST + delivery row).
 */
@ApiTags("webhooks")
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @Roles("site_admin")
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.webhooks.list() });
  }

  @Post()
  @Roles("site_admin")
  async create(
    @Body() dto: CreateWebhookDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.webhooks.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":id")
  @Roles("site_admin")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.webhooks.update(id, dto, user) });
  }

  @Delete(":id")
  @Roles("site_admin")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.webhooks.remove(id, user) });
  }

  @Get(":id/deliveries")
  @Roles("site_admin")
  async deliveries(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.webhooks.deliveries(id) });
  }

  @Post(":id/test")
  @Roles("site_admin")
  @ApiOperation({ summary: "Send a signed test event to this subscription" })
  async sendTest(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.webhooks.sendTest(id, user);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }
}
