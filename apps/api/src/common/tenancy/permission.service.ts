import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { permissionsForBuiltinRole, type Role } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { customRoles, siteMembers } from "@database/schema";

/**
 * RBAC-2: resolves a member's EFFECTIVE permission set for a site.
 *
 * Resolution order (additive, never subtracts from built-in behaviour):
 *  1. Platform admins → all permissions (super_admin default).
 *  2. Member with an assigned, live custom role → that custom role's permissions.
 *  3. Otherwise → the built-in `role`'s default permission set.
 *
 * Not request-scoped — it only reads. Used by PermissionGuard + the members
 * service (to surface effective permissions in the admin UI).
 */
@Injectable()
export class PermissionService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Effective permissions for a user on a site (empty if not a member). */
  async getEffectivePermissions(userId: string, siteId: string): Promise<string[]> {
    const [row] = await this.db
      .select({
        role: siteMembers.role,
        customRoleId: siteMembers.customRoleId,
      })
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
    if (!row) return [];

    if (row.customRoleId) {
      const custom = await this.getCustomRolePermissions(siteId, row.customRoleId);
      if (custom) return custom;
    }
    return permissionsForBuiltinRole(row.role as Role);
  }

  /** Permissions for an assigned custom role, or null if missing/deleted. */
  async getCustomRolePermissions(siteId: string, customRoleId: string): Promise<string[] | null> {
    const [role] = await this.db
      .select({ permissions: customRoles.permissions })
      .from(customRoles)
      .where(
        and(
          eq(customRoles.id, customRoleId),
          eq(customRoles.siteId, siteId),
          isNull(customRoles.deletedAt),
        ),
      )
      .limit(1);
    return role ? [...(role.permissions ?? [])] : null;
  }
}
