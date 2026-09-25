import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
} from "@nestjs/common";
import { Reflector, REQUEST } from "@nestjs/core";
import type { Request } from "express";
import { SITE_ID_HEADER, type Role } from "@ob-cms/shared";
import { IS_PUBLIC_KEY } from "@common/decorators/public.decorator";
import { ROLES_KEY } from "@common/decorators/roles.decorator";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { MembershipService } from "@common/tenancy/membership.service";
import { TenantContext } from "@common/tenancy/tenant-context";

/**
 * Resolves + validates the active site for admin requests (TECH-ARCHITECTURE
 * §3.1). The site comes from the `X-Site-Id` header or a `:siteId` route param.
 *
 * - Public routes: skipped.
 * - Routes with no `@Roles` and no site provided: skipped (site-agnostic authed
 *   endpoints like /auth/me, /sites list, /invitations/accept).
 * - Platform admins: membership check bypassed, but the siteId is STILL set on
 *   the context so scoping still applies (super_admin sees one site at a time).
 * - Otherwise: the user MUST be an active member of the site, else 403 — before
 *   the service runs. This is the cross-tenant boundary (FND-2/3).
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membership: MembershipService,
    private readonly tenantContext: TenantContext,
    @Inject(REQUEST) private readonly request: Request & { user?: AuthUser },
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const user = this.request.user;
    if (!user) return true; // JwtAuthGuard already rejected unauthenticated reqs

    const siteId = this.resolveSiteId(this.request);
    const requiresRole = this.reflector.getAllAndOverride<Role>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!siteId) {
      // No site context. If the handler needs a per-site role, that's a 403.
      if (requiresRole && !user.isPlatformAdmin) {
        throw new ForbiddenException("Active site required (missing X-Site-Id)");
      }
      return true;
    }

    if (user.isPlatformAdmin) {
      // Membership bypassed; scoping still applied. Role = super_admin.
      this.tenantContext.setSite(siteId, "super_admin");
      return true;
    }

    const role = await this.membership.getRoleForSite(user.userId, siteId);
    if (!role) {
      // Not a member of this site → 403 before the service runs.
      throw new ForbiddenException("You are not a member of this site");
    }
    this.tenantContext.setSite(siteId, role);
    return true;
  }

  /**
   * Resolve the active site from the `:siteId` path param (the canonical
   * resource) or the `X-Site-Id` header. If BOTH are present and DIFFER, reject
   * — this closes the IDOR foot-gun where a member of A spoofs `X-Site-Id: A`
   * while the path targets B (or vice-versa). When both agree (or only one is
   * present) that value is the single active site for the whole request.
   */
  private resolveSiteId(req: Request): string | undefined {
    const header = req.headers[SITE_ID_HEADER];
    const fromHeader = (Array.isArray(header) ? header[0] : header)?.trim() || undefined;
    const fromParam =
      (req.params as Record<string, string | undefined>)?.siteId?.trim() || undefined;

    if (fromHeader && fromParam && fromHeader !== fromParam) {
      throw new ForbiddenException("X-Site-Id does not match the requested site");
    }
    return fromParam ?? fromHeader;
  }
}
