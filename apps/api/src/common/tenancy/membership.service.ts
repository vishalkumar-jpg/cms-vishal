import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { Role } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { siteMembers } from "@database/schema";

/**
 * Per-site membership lookups used by the TenantGuard/RolesGuard and the
 * sites/team modules. Not request-scoped — it only reads.
 */
@Injectable()
export class MembershipService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The active (non-deleted) role a user has on a given site, or null. */
  async getRoleForSite(userId: string, siteId: string): Promise<Role | null> {
    const [row] = await this.db
      .select({ role: siteMembers.role })
      .from(siteMembers)
      .where(
        and(
          eq(siteMembers.userId, userId),
          eq(siteMembers.siteId, siteId),
          eq(siteMembers.status, "active"),
          isNull(siteMembers.deletedAt),
        ),
      )
      .limit(1);
    return (row?.role as Role | undefined) ?? null;
  }

  /** True if the user has a platform-wide super_admin membership (siteId NULL). */
  async isPlatformAdmin(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: siteMembers.id })
      .from(siteMembers)
      .where(
        and(
          eq(siteMembers.userId, userId),
          isNull(siteMembers.siteId),
          eq(siteMembers.role, "super_admin"),
          eq(siteMembers.status, "active"),
          isNull(siteMembers.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** All of a user's site memberships (excludes the platform super_admin row). */
  async listMemberships(userId: string): Promise<Array<{ siteId: string | null; role: Role }>> {
    const rows = await this.db
      .select({ siteId: siteMembers.siteId, role: siteMembers.role })
      .from(siteMembers)
      .where(
        and(
          eq(siteMembers.userId, userId),
          eq(siteMembers.status, "active"),
          isNull(siteMembers.deletedAt),
        ),
      );
    return rows.map((r) => ({ siteId: r.siteId, role: r.role as Role }));
  }
}
