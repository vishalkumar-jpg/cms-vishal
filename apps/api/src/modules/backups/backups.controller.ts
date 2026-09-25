import { Body, Controller, Delete, Get, Param, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { PlatformAdmin } from "@common/decorators/platform-admin.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { BackupsService } from "./backups.service";
import { RestoreBackupDto } from "./dto/backups.dto";

/**
 * Platform-admin DATABASE BACKUP API (gap E26) — CROSS-TENANT, super-admin only.
 *
 * The whole controller is `@PlatformAdmin()`, so the global PlatformAdminGuard
 * hard-fails (403) for any caller without `isPlatformAdmin`. Backups are a dump
 * of the WHOLE cluster — these routes carry NO `X-Site-Id` and are NOT
 * site-scoped. The actual pg_dump/pg_restore runs in the worker.
 */
@ApiTags("platform-backups")
@PlatformAdmin()
@Controller("platform/backups")
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  @ApiOperation({ summary: "List all database backups (platform admin only)" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.backups.list() });
  }

  @Post()
  @ApiOperation({ summary: "Trigger a manual backup → enqueues a worker job, returns the pending row" })
  async trigger(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    const data = await this.backups.trigger(user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Get a download URL for a completed backup dump" })
  async download(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.backups.downloadUrl(id) });
  }

  @Post(":id/restore")
  @ApiOperation({
    summary:
      "Restore a backup (enqueues a restore job). DESTRUCTIVE — requires { confirm: true }; overwrites all current data.",
  })
  async restore(
    @Param("id") id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    // `confirm: true` is enforced by RestoreBackupDto (@Equals(true)); a missing
    // or false flag is rejected 400 by the global ValidationPipe before we reach
    // here, so no destructive job is ever enqueued without explicit consent.
    return responseUtils.success(res, { data: await this.backups.restore(id, user) });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a backup dump + its ledger row" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.backups.remove(id, user) });
  }
}
