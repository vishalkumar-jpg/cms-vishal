import { Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { TenantContext } from "@common/tenancy/tenant-context";
import { NotificationsService } from "./notifications.service";

/**
 * Header-bell notifications. Every endpoint is auth + active-site scoped AND
 * current-user scoped in the service (recipientUserId == me), so a user only
 * ever sees / mutates their own notifications. `@Roles("contributor")` is the
 * lowest authenticated site role — any team member gets a bell.
 */
@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly ctx: TenantContext,
  ) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List my recent notifications + my unread count" })
  async list(
    @CurrentUser() user: AuthUser,
    @Query("unread") unread: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.notifications.list(
      this.ctx.requireSiteId(),
      user.userId,
      unread === "true" || unread === "1",
    );
    return responseUtils.success(res, { data });
  }

  @Post(":id/read")
  @Roles("contributor")
  @ApiOperation({ summary: "Mark one of my notifications read" })
  async markRead(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.notifications.markRead(this.ctx.requireSiteId(), user.userId, id);
    return responseUtils.success(res, { data });
  }

  @Post("read-all")
  @Roles("contributor")
  @ApiOperation({ summary: "Mark all my notifications read" })
  async markAllRead(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    const data = await this.notifications.markAllRead(this.ctx.requireSiteId(), user.userId);
    return responseUtils.success(res, { data });
  }
}
