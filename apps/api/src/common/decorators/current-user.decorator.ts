import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
}

/**
 * `@CurrentUser()` — inject the authenticated principal into a handler param.
 * Returns `undefined` on @Public routes (no auth ran).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return req.user;
  },
);
