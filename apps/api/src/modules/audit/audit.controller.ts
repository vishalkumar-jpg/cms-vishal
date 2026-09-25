import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiParam } from "@nestjs/swagger";
import { and, desc, eq, type SQL } from "drizzle-orm";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { auditLog, systemUsers } from "@database/schema";
import { Roles } from "@common/decorators/roles.decorator";
import { ScopedRepository } from "@common/tenancy/scoped-repository";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const clampInt = (raw: string | undefined, fallback: number, max: number): number => {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(n, max);
};

/**
 * Read-only, append-only audit log (FND-25..27). Site-scoped: a member of one
 * site only ever sees that site's events. There is NO write/update/delete
 * endpoint by design — rows are emitted internally by AuditService.record().
 *
 * Supports `limit`/`offset` (load-more pagination) plus optional `category`,
 * `action`, and `entityType` filters. The `category` param is kept for existing
 * callers; the new filters are additive.
 */
@ApiTags("audit")
@ApiParam({ name: "siteId", required: true })
@Controller("sites/:siteId/audit")
export class AuditController {
  constructor(private readonly repo: ScopedRepository) {}

  @Get()
  @Roles("contributor")
  @ApiOperation({ summary: "List this site's audit events (scoped, append-only)" })
  async list(
    @Param("siteId") _siteId: string,
    @Query("category") category: string | undefined,
    @Query("action") action: string | undefined,
    @Query("entityType") entityType: string | undefined,
    @Query("limit") limitRaw: string | undefined,
    @Query("offset") offsetRaw: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    const limit = clampInt(limitRaw, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = clampInt(offsetRaw, 0, Number.MAX_SAFE_INTEGER);

    const filters: Array<SQL | undefined> = [
      category ? eq(auditLog.category, category) : undefined,
      action ? eq(auditLog.action, action) : undefined,
      entityType ? eq(auditLog.entityType, entityType) : undefined,
    ];
    // ScopedRepository injects `site_id = ctx.siteId AND deleted_at IS NULL`.
    const where = this.repo.scope(auditLog, and(...filters));

    const rows = await this.repo.db
      .select({
        id: auditLog.id,
        siteId: auditLog.siteId,
        actorId: auditLog.actorId,
        actorEmail: systemUsers.email,
        action: auditLog.action,
        category: auditLog.category,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(systemUsers, eq(systemUsers.id, auditLog.actorId))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit + 1)
      .offset(offset);

    // load-more: fetch one extra to know whether more pages exist.
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return responseUtils.success(res, { data: { rows: data, hasMore, limit, offset } });
  }
}
