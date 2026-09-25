import { Inject, Injectable, Scope } from "@nestjs/common";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { TenantContext } from "./tenant-context";

/**
 * ScopedRepository — THE tenant-isolation boundary (TECH-ARCHITECTURE §3.2).
 *
 * RULE: every read/write of a tenant-scoped table (any table carrying `siteId`)
 * MUST go through this helper. It ANDs `eq(table.siteId, ctx.siteId)` AND
 * `isNull(table.deletedAt)` into the predicate so that:
 *   - cross-tenant reads return empty,
 *   - cross-tenant writes affect 0 rows (IDOR → 404, not 403, to avoid leaking
 *     existence),
 *   - soft-deleted rows never leak.
 *
 * Never add a "skip scoping" flag. Platform-wide listings use the explicit
 * /platform/* endpoints with the raw `db`, never this helper with scoping off.
 *
 * It is request-scoped because it closes over the request's TenantContext.
 */
@Injectable({ scope: Scope.REQUEST })
export class ScopedRepository {
  constructor(
    @Inject(DRIZZLE) public readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  /**
   * Build the mandatory tenant predicate for a table. Pass extra conditions to
   * be ANDed in. Throws (fail-closed) if there is no active siteId.
   *
   * Usage:
   *   const rows = await repo.db.select().from(sites)
   *     .where(repo.scope(sites, eq(sites.id, id)));
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scope(table: PgTable & { siteId: any; deletedAt: any }, ...extra: Array<SQL | undefined>): SQL {
    const siteId = this.ctx.requireSiteId();
    return and(eq(table.siteId, siteId), isNull(table.deletedAt), ...extra) as SQL;
  }

  /** Values to spread into an insert so the row is stamped with the active site. */
  insertDefaults(): { siteId: string; createdBy?: string } {
    return { siteId: this.ctx.requireSiteId(), createdBy: this.ctx.userId };
  }

  get siteId(): string {
    return this.ctx.requireSiteId();
  }
}
