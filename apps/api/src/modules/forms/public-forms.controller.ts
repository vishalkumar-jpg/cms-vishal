import { Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import responseUtils from "@utils/response.utils";
import { Public } from "@common/decorators/public.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { PublicFormsService } from "./public-forms.service";
import { PublicFormUploadService } from "./public-form-upload.service";
import { FormUploadPresignDto, SubmitFormDto } from "./dto/submit-form.dto";

/**
 * PUBLIC forms surface (@Public, host-resolved). Lives at /api/v1/public/forms/*.
 * The site is resolved SERVER-SIDE from the Host header — a client-supplied
 * siteId is NEVER trusted. Only published forms belonging to the resolved site
 * are served/accept submissions (else 404, no existence leak).
 */
@ApiTags("public-forms")
@Controller("public/forms")
export class PublicFormsController {
  constructor(
    private readonly forms: PublicFormsService,
    private readonly uploads: PublicFormUploadService,
  ) {}

  @Public()
  @Get(":formId")
  @ApiOperation({ summary: "Public form schema for render (fields + settings only)" })
  async getForm(
    @Param("formId") formId: string,
    @PublicHost() host: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.forms.getPublicForm(host, formId) });
  }

  @Public()
  @Post(":formId/submit")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "form-submit" })
  @ApiOperation({ summary: "Public form submission — persists then enqueues CRM delivery" })
  async submit(
    @Param("formId") formId: string,
    @Body() dto: SubmitFormDto,
    @PublicHost() host: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<Response> {
    const result = await this.forms.submit(
      host,
      formId,
      {
        data: dto.data,
        honeypot: dto._hp,
        renderedAt: dto.renderedAt,
        utm: dto.utm,
        captchaToken: dto.captchaToken,
        visitorId: dto.visitorId,
      },
      {
        ip: this.clientIp(req),
        ua: req.headers["user-agent"],
        referrer: (req.headers["referer"] || req.headers["referrer"]) as string | undefined,
      },
    );
    return responseUtils.success(res, { data: result, status: StatusCodes.CREATED });
  }

  @Public()
  @Post(":formId/upload")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "form-upload" })
  @ApiOperation({ summary: "Presign a file-upload for a form field (direct browser PUT to S3)" })
  async presignUpload(
    @Param("formId") formId: string,
    @Body() dto: FormUploadPresignDto,
    @PublicHost() host: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.uploads.presign(host, formId, {
      filename: dto.filename,
      contentType: dto.contentType,
      size: dto.size,
    });
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  /** First X-Forwarded-For hop, else the socket address. */
  private clientIp(req: Request): string | undefined {
    const xff = req.headers["x-forwarded-for"];
    const first = Array.isArray(xff) ? xff[0] : xff?.split(",")[0];
    return (first || req.socket?.remoteAddress || undefined)?.trim();
  }
}
