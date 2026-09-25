import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { Public } from "@common/decorators/public.decorator";
import { PublicHost } from "@common/decorators/public-host.decorator";
import { RateLimit } from "@common/decorators/rate-limit.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { IdentityService } from "./identity.service";
import { RULE_FIELDS, RULE_OPERATORS } from "./rules";
import { IdentifyDto, ScoringRuleDto, VisitorsQueryDto } from "./dto/identity.dto";

/**
 * Identity center (Phase 3). A @Public host-resolved IDENTIFY beacon
 * (`/api/identify`, links email→visitorId) + the site-scoped intelligence reads
 * (visitors, 360, identities, companies) and scoring-rule CRUD, plus a rebuild
 * trigger. All authenticated routes are ScopedRepository-guarded (no cross-tenant
 * leak); the identify beacon resolves the tenant from the Host header only.
 */
@ApiTags("identity")
@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  // --- Identify (@Public, host-resolved) ------------------------------------

  @Public()
  @Post("identify")
  @RateLimit({ ...rateLimitConfig.buckets.form, keyBy: "ip", name: "identify" })
  @ApiOperation({ summary: "Link an email to a visitorId (host-resolved). Returns 204." })
  async identify(
    @PublicHost() host: string | undefined,
    @Body() dto: IdentifyDto,
    @Res() res: Response,
  ): Promise<Response> {
    await this.identity.identify(host, dto);
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  // --- Field/operator catalog (for the admin rule pickers) ------------------

  @Get("identity/rule-fields")
  @Roles("contributor")
  @ApiOperation({ summary: "Available rule fields + operators (scoring + audiences)" })
  async ruleFields(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: { fields: RULE_FIELDS, operators: RULE_OPERATORS } });
  }

  // --- Visitors -------------------------------------------------------------

  @Get("identity/visitors")
  @Roles("contributor")
  @ApiOperation({ summary: "List visitor profiles (filter/sort by score/lastSeen/identified)" })
  async visitors(@Query() q: VisitorsQueryDto, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.identity.listVisitors(q) });
  }

  @Get("identity/visitors/:id")
  @Roles("contributor")
  @ApiOperation({ summary: "Visitor 360 — profile, identity, company + event timeline" })
  async visitor(@Param("id") id: string, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.identity.getVisitor(id) });
  }

  @Get("identity/identities")
  @Roles("contributor")
  @ApiOperation({ summary: "List known identities (email + company)" })
  async identities(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.identity.listIdentities() });
  }

  @Get("identity/companies")
  @Roles("contributor")
  @ApiOperation({ summary: "List identified companies (by email domain) + people count" })
  async companies(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.identity.listCompanies() });
  }

  // --- Scoring rules (editor+ write) ----------------------------------------

  @Get("identity/scoring-rules")
  @Roles("contributor")
  @ApiOperation({ summary: "List lead-scoring rules" })
  async scoringRules(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.identity.listScoringRules() });
  }

  @Post("identity/scoring-rules")
  @Roles("editor")
  @ApiOperation({ summary: "Create a lead-scoring rule" })
  async createScoringRule(
    @Body() dto: ScoringRuleDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    const data = await this.identity.createScoringRule(dto, user);
    return responseUtils.success(res, { data, status: StatusCodes.CREATED });
  }

  @Put("identity/scoring-rules/:id")
  @Roles("editor")
  async updateScoringRule(
    @Param("id") id: string,
    @Body() dto: ScoringRuleDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.identity.updateScoringRule(id, dto, user) });
  }

  @Delete("identity/scoring-rules/:id")
  @Roles("editor")
  async deleteScoringRule(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.identity.deleteScoringRule(id, user) });
  }

  // --- Rebuild --------------------------------------------------------------

  @Post("identity/rebuild")
  @Roles("editor")
  @ApiOperation({ summary: "Enqueue the profile-rebuild + scoring recompute job" })
  async rebuild(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.identity.enqueueRebuild(user),
      status: StatusCodes.ACCEPTED,
    });
  }
}
