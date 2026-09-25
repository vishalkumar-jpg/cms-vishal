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
import { hasRoleAtLeast, type Role } from "@ob-cms/shared";
import { IS_PUBLIC_KEY } from "@common/decorators/public.decorator";
import { ROLES_KEY } from "@common/decorators/roles.decorator";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { TenantContext } from "@common/tenancy/tenant-context";

/**
 * Declarative role enforcement (FND-8/10). Reads the `@Roles(min)` metadata and
 * checks the caller's role on the active site against the hierarchy
 * (super_admin ⊃ site_admin ⊃ editor ⊃ contributor). Platform admins always
 * pass. Runs AFTER TenantGuard (which sets the role on the context).
 */
@Injectable({ scope: Scope.REQUEST })
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
    @Inject(REQUEST) private readonly request: Request & { user?: AuthUser },
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRole = this.reflector.getAllAndOverride<Role>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRole) return true; // authed-only handler

    const user = this.request.user;
    if (user?.isPlatformAdmin) return true; // hierarchy short-circuit

    const role = this.tenantContext.role;
    if (!role || !hasRoleAtLeast(role, requiredRole)) {
      throw new ForbiddenException("Insufficient role for this action");
    }
    return true;
  }
}
