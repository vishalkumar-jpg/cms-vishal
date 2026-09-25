import { randomBytes } from "node:crypto";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { IS_PUBLIC_KEY } from "@common/decorators/public.decorator";
import { authConfig } from "@config/auth.config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Non-httpOnly cookie holding the CSRF token (readable by the SPA). */
export const CSRF_COOKIE = "ob_csrf";
/** Header the SPA echoes the token back in (double-submit). */
export const CSRF_HEADER = "x-csrf-token";

/**
 * CSRF protection (WAVE4b) via the double-submit-cookie pattern.
 *
 * Threat model: only COOKIE-authenticated, state-changing requests are forgeable
 * cross-site. So enforcement is scoped precisely:
 *
 *   ENFORCE when ALL hold:
 *     - method is unsafe (POST/PUT/PATCH/DELETE)
 *     - the request carries our session COOKIE (browser ambient auth)
 *     - the route is NOT @Public (webhooks / public form submit / render are exempt)
 *   EXEMPT otherwise — notably Bearer-token API clients (no ambient cookie) and
 *   all @Public surfaces, so SDKs, the renderer, webhooks and form posts are
 *   untouched.
 *
 * The token is a random value mirrored in a readable cookie and an X-CSRF-Token
 * header; an attacker on another origin cannot read the cookie to forge the
 * header (SOP). SameSite=Lax on the session cookie is the first line; this is
 * defense-in-depth. The guard also seeds/refreshes the cookie on safe requests.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<
      Request & { cookies?: Record<string, string>; headers: Record<string, unknown> }
    >();
    const res = http.getResponse<Response>();

    // Seed a CSRF cookie for the SPA on any safe (idempotent) request.
    if (SAFE_METHODS.has(req.method)) {
      this.ensureCsrfCookie(req, res);
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Only cookie-authenticated requests are CSRF-forgeable. Bearer clients skip.
    const hasSessionCookie = Boolean(req.cookies?.[authConfig.cookieName]);
    const authHeader = req.headers.authorization;
    const isBearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ");
    if (!hasSessionCookie || isBearer) return true;

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = this.headerToken(req);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException("Invalid or missing CSRF token");
    }
    return true;
  }

  private headerToken(req: Request): string | undefined {
    const raw = req.headers[CSRF_HEADER];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
  }

  private ensureCsrfCookie(
    req: Request & { cookies?: Record<string, string> },
    res: Response,
  ): void {
    if (req.cookies?.[CSRF_COOKIE]) return;
    const token = randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // must be readable by the SPA to echo into the header
      secure: authConfig.cookieSecure,
      sameSite: "lax",
      domain: authConfig.cookieDomain,
      path: "/",
    });
  }
}
