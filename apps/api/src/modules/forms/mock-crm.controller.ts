import {
  ForbiddenException,
  Inject,
  Injectable,
  Controller,
  Headers,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import {
  CRM_IDEMPOTENCY_HEADER,
  CRM_SIGNATURE_HEADER,
  CRM_TIMESTAMP_HEADER,
  verifyCrmPayload,
} from "@ob-cms/crypto";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { mockCrmReceipts } from "@database/schema";
import { Public } from "@common/decorators/public.decorator";
import { appConfig } from "@config/app.config";
import { getOsEnvOptional } from "@config/env.config";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * MOCK CRM receiver (local dev only). Closes the forms→CRM loop end-to-end
 * without a real CRM: verifies the HMAC over the EXACT raw body the worker
 * signed, then stores the receipt. Guarded to non-production so it can never be
 * reached in prod. Default target of CRM_WEBHOOK_URL in local env.
 */
@Injectable()
class MockCrmService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private secret(): string {
    return (
      getOsEnvOptional("CRM_MOCK_SECRET") ??
      getOsEnvOptional("CRM_HMAC_SECRET") ??
      "dev-crm-secret"
    );
  }

  async receive(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
    idempotencyKey: string | undefined,
  ): Promise<{ ok: boolean; signatureValid: boolean }> {
    const raw = rawBody ? rawBody.toString("utf8") : "";
    const signatureValid = verifyCrmPayload(this.secret(), signature, timestamp, raw);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    await this.db.insert(mockCrmReceipts).values({
      siteId: typeof parsed.siteId === "string" ? parsed.siteId : null,
      formId: typeof parsed.formId === "string" ? parsed.formId : null,
      submissionId: typeof parsed.submissionId === "string" ? parsed.submissionId : null,
      idempotencyKey: idempotencyKey ?? null,
      signatureValid,
      payload: parsed as unknown,
    });

    return { ok: signatureValid, signatureValid };
  }
}

@ApiTags("dev")
@Controller("dev")
export class MockCrmController {
  constructor(private readonly mock: MockCrmService) {}

  @Public()
  @Post("mock-crm")
  @ApiOperation({ summary: "[dev-only] Mock CRM receiver — verifies HMAC + stores receipt" })
  async receive(
    @Headers(CRM_SIGNATURE_HEADER) signature: string | undefined,
    @Headers(CRM_TIMESTAMP_HEADER) timestamp: string | undefined,
    @Headers(CRM_IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<Response> {
    if (appConfig.environment === "production") {
      throw new ForbiddenException("Mock CRM is disabled in production");
    }
    const result = await this.mock.receive(req.rawBody, signature, timestamp, idempotencyKey);
    // A real CRM returns non-2xx on a bad signature so the worker can retry.
    const status = result.signatureValid ? StatusCodes.OK : StatusCodes.UNAUTHORIZED;
    return res.status(status).send({ data: result, status });
  }
}

export { MockCrmService };
