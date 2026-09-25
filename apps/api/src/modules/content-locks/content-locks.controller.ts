import { Body, Controller, Delete, Get, Param, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { ContentLocksService, type LockEntity } from "./content-locks.service";
import { AcquireLockDto } from "./dto/lock.dto";

/**
 * CONTENT-OPS — advisory concurrent-edit locks for the page/post builders.
 * Exposes `GET/POST/DELETE {pages,posts}/:id/lock`. Contributor+ (anyone who can
 * open the builder). Soft: acquiring never blocks a save.
 */
@ApiTags("content-locks")
@Controller()
export class ContentLocksController {
  constructor(private readonly locks: ContentLocksService) {}

  // -- pages ------------------------------------------------------------------

  @Get("pages/:id/lock")
  @Roles("contributor")
  @ApiOperation({ summary: "Who currently holds the edit lock on a page" })
  page(@Param("id") id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    return this.read("page", id, user, res);
  }

  @Post("pages/:id/lock")
  @Roles("contributor")
  @ApiOperation({ summary: "Acquire/heartbeat the page edit lock (?takeOver to steal)" })
  acquirePage(
    @Param("id") id: string,
    @Body() dto: AcquireLockDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    return this.doAcquire("page", id, dto, user, res);
  }

  @Delete("pages/:id/lock")
  @Roles("contributor")
  @ApiOperation({ summary: "Release the page edit lock (holder only)" })
  releasePage(@Param("id") id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    return this.doRelease("page", id, user, res);
  }

  // -- posts ------------------------------------------------------------------

  @Get("posts/:id/lock")
  @Roles("contributor")
  @ApiOperation({ summary: "Who currently holds the edit lock on a post" })
  post(@Param("id") id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    return this.read("post", id, user, res);
  }

  @Post("posts/:id/lock")
  @Roles("contributor")
  @ApiOperation({ summary: "Acquire/heartbeat the post edit lock (?takeOver to steal)" })
  acquirePost(
    @Param("id") id: string,
    @Body() dto: AcquireLockDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    return this.doAcquire("post", id, dto, user, res);
  }

  @Delete("posts/:id/lock")
  @Roles("contributor")
  @ApiOperation({ summary: "Release the post edit lock (holder only)" })
  releasePost(@Param("id") id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    return this.doRelease("post", id, user, res);
  }

  // -- shared -----------------------------------------------------------------

  private async read(
    entity: LockEntity,
    id: string,
    user: AuthUser,
    res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.locks.get(entity, id, user) });
  }

  private async doAcquire(
    entity: LockEntity,
    id: string,
    dto: AcquireLockDto,
    user: AuthUser,
    res: Response,
  ): Promise<Response> {
    const data = await this.locks.acquire(entity, id, user, dto.takeOver === true);
    return responseUtils.success(res, { data });
  }

  private async doRelease(
    entity: LockEntity,
    id: string,
    user: AuthUser,
    res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.locks.release(entity, id, user) });
  }
}
