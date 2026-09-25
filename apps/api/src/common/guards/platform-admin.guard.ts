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
import { IS_PLATFORM_ADMIN_KEY } from "@common/decorators/platform-admin.decorator";
import type { AuthUser } from "@common/decorators/current-user.decorator";

/**
 * Cross-tenant authorization gate for `@PlatformAdmin()` routes (the platform
 * console). Runs in the global guard chain AFTER JwtAuthGuard (which sets
 * `req.user`) and is a no-op for every route NOT flagged `@PlatformAdmin()`.
 *
 * For flagged routes it hard-fails (403) unless `req.user.isPlatformAdmin` is
 * true. There is intentionally no per-site / hierarchy escape hatch — platform
 * routes read the raw `db` across all tenants, so only the platform super-admin
 * (the `siteId IS NULL` super_admin membership, denormalized onto
 * `system_users.isPlatformAdmin`) may pass.
 */
@Injectable({ scope: Scope.REQUEST })
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REQUEST) private readonly request: Request & { user?: AuthUser },
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPlatform) return true; // not a platform route — leave it to the other guards

    const user = this.request.user;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException("Platform admin access required");
    }
    return true;
  }
}
