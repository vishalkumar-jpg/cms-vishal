import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { CommentsService } from "./comments.service";
import { CreateCommentDto, ReplyCommentDto, ResolveCommentDto } from "./dto/comment.dto";

@ApiTags("comments")
@Controller("comments")
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List all comments (threads + replies) for a page" })
  async list(@Query("pageId") pageId: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.comments.listForPage(pageId) });
  }

  @Post()
  @Roles("contributor")
  @ApiOperation({ summary: "Create a comment thread on a node or a canvas point" })
  async create(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.comments.create(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Post(":id/replies")
  @Roles("contributor")
  async reply(
    @Param("id") id: string,
    @Body() dto: ReplyCommentDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.comments.reply(id, dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Patch(":id/resolve")
  @Roles("contributor")
  async resolve(
    @Param("id") id: string,
    @Body() dto: ResolveCommentDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.comments.setResolved(id, dto, user) });
  }

  @Delete(":id")
  @Roles("contributor")
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.comments.remove(id, user) });
  }
}
