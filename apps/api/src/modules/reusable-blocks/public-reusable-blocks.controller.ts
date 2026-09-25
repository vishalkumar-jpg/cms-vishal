import { Controller, Get, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { PublicReusableBlocksService } from "./public-reusable-blocks.service";

/**
 * PUBLIC reusable-blocks surface (@Public, host-resolved). Lives at
 * /api/v1/public/reusable-blocks/*. The site is resolved SERVER-SIDE from the Host
 * header — a client-supplied siteId is NEVER trusted. The renderer's same-origin
 * proxy hits this to resolve a `ReusableBlock` reference's layout at render time.
 */
@ApiTags("public-reusable-blocks")
@Controller("public/reusable-blocks")
export class PublicReusableBlocksController {
  constructor(private readonly blocks: PublicReusableBlocksService) {}

  @Public()
  @Get(":id")
  @ApiOperation({ summary: "Public reusable-block layout for render (host-resolved)" })
  async get(
    @Param("id") id: string,
    @PublicHost() host: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.blocks.getLayout(host, id) });
  }
}
