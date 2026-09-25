import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiParam } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import type { AiProvider } from "@database/schema";
import { AiService } from "./ai.service";
import {
  AltTextDto,
  GenerateDto,
  RefineDto,
  SectionDto,
  SetAiKeyDto,
  TextOpDto,
} from "./dto/ai.dto";

/** Per-tenant minute + monthly caps shared by generate and refine. */
const AI_RATE_LIMIT = [
  { ...rateLimitConfig.buckets.aiMinute, keyBy: "tenant" as const, name: "ai-min" },
  { ...rateLimitConfig.buckets.aiMonthly, keyBy: "tenant" as const, name: "ai-month" },
];

/**
 * AI copilot (WAVE4a). Tenant-scoped, editor+ for generation; key management is
 * also editor+. Generation is async: POST returns a jobId, the worker runs the
 * schema-grounded LLM and (on success) creates/updates a DRAFT page — never
 * published. Keys are stored encrypted and returned only masked.
 */
@ApiTags("ai")
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  // ---- BYOK keys ----------------------------------------------------------

  @Post("keys")
  @Roles("editor")
  @ApiOperation({ summary: "Set/rotate a BYOK provider key (encrypted at rest)" })
  async setKey(
    @Body() dto: SetAiKeyDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.ai.setKey(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Get("keys")
  @Roles("editor")
  @ApiOperation({ summary: "List configured BYOK keys (masked)" })
  async listKeys(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.ai.listKeys() });
  }

  @ApiParam({ name: "provider", required: true })

  @Delete("keys/:provider")
  @Roles("editor")
  @ApiOperation({ summary: "Delete a BYOK provider key" })
  async deleteKey(
    @Param("provider") provider: AiProvider,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.ai.deleteKey(provider, user) });
  }

  // ---- Generation ---------------------------------------------------------

  @Post("generate")
  @Roles("editor")
  @RateLimit(AI_RATE_LIMIT)
  @ApiOperation({ summary: "Enqueue a page generation (returns a jobId)" })
  async generate(
    @Body() dto: GenerateDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.ai.generate(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }

  @Post("refine")
  @Roles("editor")
  @RateLimit(AI_RATE_LIMIT)
  @ApiOperation({ summary: "Enqueue a refinement of an existing page's draft layout" })
  async refine(
    @Body() dto: RefineDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.ai.refine(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.ACCEPTED });
  }

  @Get("jobs/:id")
  @Roles("editor")
  @ApiOperation({ summary: "Get a generation job's status + result" })
  async getJob(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.ai.getJob(id) });
  }

  // ---- In-canvas SYNC AI assist -------------------------------------------
  //
  // Unlike generate/refine (async, job-based via the worker), these return the
  // result inline so the builder can apply it immediately. Mock-aware via
  // AI_MOCK; BYOK key required otherwise (clean 400 if missing).

  @Post("text")
  @Roles("editor")
  @RateLimit(AI_RATE_LIMIT)
  @ApiOperation({ summary: "Transform selected text (rewrite/shorten/expand/…) — returns { text }" })
  async textOp(@Body() dto: TextOpDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.ai.textOp(dto) });
  }

  @Post("alt-text")
  @Roles("editor")
  @RateLimit(AI_RATE_LIMIT)
  @ApiOperation({ summary: "Generate concise alt text for an image — returns { altText }" })
  async altText(@Body() dto: AltTextDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.ai.altText(dto) });
  }

  @Post("section")
  @Roles("editor")
  @RateLimit(AI_RATE_LIMIT)
  @ApiOperation({ summary: "Generate one page section subtree from a prompt — returns { layout }" })
  async section(@Body() dto: SectionDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.ai.section(dto) });
  }
}
