import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector, REQUEST } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "@common/decorators/public.decorator";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { TokenService } from "@common/auth/token.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import { authConfig } from "@config/auth.config";

/**
 * Global authentication guard (auth-by-default). Every route requires a valid
 * session cookie UNLESS the handler/controller is marked `@Public`. Populates
 * `req.user` and the request-scoped TenantContext with the principal.
 *
 * Request-scoped so it can inject the per-request TenantContext.
 */
@Injectable({ scope: Scope.REQUEST })
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly tenantContext: TenantContext,
    @Inject(REQUEST) private readonly request: Request & { user?: AuthUser },
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const token = this.extractToken(this.request);
    if (!token) throw new UnauthorizedException("Authentication required");

    const payload = this.tokenService.verify(token);
    const user: AuthUser = {
      userId: payload.sub,
      email: payload.email,
      isPlatformAdmin: payload.isPlatformAdmin,
    };
    this.request.user = user;
    this.tenantContext.setUser(user);
    return true;
  }

  private extractToken(req: Request & { cookies?: Record<string, string> }): string | undefined {
    const fromCookie = req.cookies?.[authConfig.cookieName];
    if (fromCookie) return fromCookie;
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    return undefined;
  }
}
