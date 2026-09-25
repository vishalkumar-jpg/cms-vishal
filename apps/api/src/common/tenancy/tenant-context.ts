import { Injectable, Scope } from "@nestjs/common";
import type { Role } from "@ob-cms/shared";

/**
 * Request-scoped tenant context — the single source of truth for "who is acting,
 * inside which site" for the current request. Populated by the JwtAuthGuard
 * (user) and TenantGuard (siteId + role), then consumed by RolesGuard, the
 * ScopedRepository, and AuditService.
 *
 * Because it is `Scope.REQUEST`, every consumer that injects it gets a fresh
 * instance per request — there is no ambient cross-request leakage.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  userId?: string;
  email?: string;
  isPlatformAdmin = false;

  /** Active site for this request (from X-Site-Id header or :siteId param). */
  siteId?: string;
  /** The acting user's role on `siteId` (or super_admin if platform admin). */
  role?: Role;

  setUser(u: { userId: string; email: string; isPlatformAdmin: boolean }): void {
    this.userId = u.userId;
    this.email = u.email;
    this.isPlatformAdmin = u.isPlatformAdmin;
  }

  setSite(siteId: string, role: Role): void {
    this.siteId = siteId;
    this.role = role;
  }

  /** Throws if no active site — used by the ScopedRepository to fail closed. */
  requireSiteId(): string {
    if (!this.siteId) {
      throw new Error(
        "TenantContext.siteId is not set — a tenant-scoped query was attempted " +
          "without an active site (missing X-Site-Id / TenantGuard not run).",
      );
    }
    return this.siteId;
  }
}
