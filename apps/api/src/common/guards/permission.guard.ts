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
import type { Permission } from "@ob-cms/shared";
import { IS_PUBLIC_KEY } from "@common/decorators/public.decorator";
import { PERMISSIONS_KEY } from "@common/decorators/permissions.decorator";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { TenantContext } from "@common/tenancy/tenant-context";
import { PermissionService } from "@common/tenancy/permission.service";

/**
 * RBAC-2: OPT-IN fine-grained permission enforcement. NO-OP unless the handler
 * carries `@RequirePermissions(...)`, so every existing route (guarded only by
 * `@Roles()`) is completely unaffected — the tenant-isolation + platform-admin
 * e2e gates keep passing untouched.
 *
 * Runs LAST in the chain (after TenantGuard sets siteId + role, and RolesGuard
 * has already enforced the coarse hierarchy). Platform admins short-circuit,
 * matching RolesGuard's behaviour.
 */
@Injectable({ scope: Scope.REQUEST })
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
    private readonly permissions: PermissionService,
    @Inject(REQUEST) private readonly request: Request & { user?: AuthUser },
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // opt-in: not annotated

    const user = this.request.user;
    if (user?.isPlatformAdmin) return true; // hierarchy short-circuit (matches RolesGuard)

    const { userId, siteId } = this.tenantContext;
    if (!userId || !siteId) {
      throw new ForbiddenException("Active site required for this action");
    }

    const effective = await this.permissions.getEffectivePermissions(userId, siteId);
    const granted = new Set(effective);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missing.join(", ")}`,
      );
    }
    return true;
  }
}
