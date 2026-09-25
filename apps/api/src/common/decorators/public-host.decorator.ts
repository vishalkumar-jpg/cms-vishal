import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/**
 * Resolves the public-facing Host for tenant resolution on @Public host-based
 * routes. Prefers `x-forwarded-host` (set by the CDN / Next.js renderer, which
 * carries the ORIGINAL visitor host) and falls back to `host` (which, for a
 * server-to-server call, is just the origin address e.g. localhost:3001).
 *
 * Node's fetch (undici) forbids overriding the `host` header, so the renderer
 * forwards the tenant host via `x-forwarded-host` — hence this preference.
 */
export const PublicHost = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const fwd = req.headers["x-forwarded-host"];
    const forwarded = Array.isArray(fwd) ? fwd[0] : fwd;
    return forwarded ?? req.headers["host"];
  },
);
