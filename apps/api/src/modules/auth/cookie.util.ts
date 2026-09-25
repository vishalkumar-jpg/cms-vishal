import type { CookieOptions, Response } from "express";
import { authConfig } from "@config/auth.config";

/** httpOnly, SameSite=Lax cookie base (Secure outside local dev). */
function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: authConfig.cookieSecure,
    sameSite: "lax",
    domain: authConfig.cookieDomain,
    path: "/",
  };
}

/**
 * Set the SHORT-lived access (session) cookie. Its lifetime is intentionally
 * brief (15m); the longer refresh cookie keeps the session alive via
 * `POST /auth/refresh`. `maxAge` only bounds the cookie's storage life — the JWT
 * `exp` is the real authority the guard verifies.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(authConfig.cookieName, token, {
    ...baseOptions(),
    maxAge: authConfig.accessTokenTtlMs,
  });
}

/** Set the longer-lived refresh cookie (rotated on every refresh). */
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(authConfig.refreshCookieName, token, {
    ...baseOptions(),
    maxAge: authConfig.refreshTokenTtlMs,
  });
}

/** Clear BOTH auth cookies (logout). */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(authConfig.cookieName, baseOptions());
  res.clearCookie(authConfig.refreshCookieName, baseOptions());
}
