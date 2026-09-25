import { Controller, Get, Res } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Public } from "@common/decorators/public.decorator";

/**
 * Health endpoint — returns the responseUtils `{ data, status }` envelope so the
 * whole pipeline (controller → envelope → admin Axios unwrap) is exercised in W0.
 */
@ApiTags("health")
@Controller()
export class AppController {
  @Public()
  @Get("health")
  @ApiOperation({ summary: "Liveness/readiness probe" })
  health(@Res() res: Response): Response {
    return responseUtils.success(res, {
      data: {
        status: "ok",
        service: "ob-cms-api",
        version: "0.0.0",
        timestamp: new Date().toISOString(),
      },
    });
  }
}
