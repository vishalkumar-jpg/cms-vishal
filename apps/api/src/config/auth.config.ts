import { getOsEnv, getOsEnvOptional } from "./env.config";

/**
 * Auth configuration — local JWT (cookie session) now; Auth0 adapter is wired
 * behind `AUTH0_ENABLED` but INERT until OfficeBeacon's Auth0 creds are given.
 */
export const authConfig = {
  jwtSecret: getOsEnv("JWT_SECRET") || "change-me-in-production",
  /** SHORT-lived access token (C21) — the refresh flow keeps sessions alive. */
  accessTokenExpiry: getOsEnvOptional("ACCESS_TOKEN_EXPIRY") ?? "15m",
  refreshTokenExpiry: getOsEnvOptional("REFRESH_TOKEN_EXPIRY") ?? "7d",
  /** Access-cookie maxAge (ms) — 15m. Matches `accessTokenExpiry`. */
  accessTokenTtlMs: 1000 * 60 * 15,
  /** Refresh-cookie + DB-row TTL (ms) — 7d. */
  refreshTokenTtlMs: 1000 * 60 * 60 * 24 * 7,
  cookieDomain: getOsEnvOptional("COOKIE_DOMAIN") || "localhost",
  /** httpOnly access (session) cookie name. */
  cookieName: "ob_session",
  /** httpOnly refresh cookie name (scoped to the refresh endpoint by path). */
  refreshCookieName: "ob_refresh",
  /** Secure cookies only outside local dev. */
  cookieSecure: (getOsEnv("ENVIRONMENT") || "local") !== "local",
  /** Auth0 adapter flag — when false the Auth0 provider is a no-op stub. */
  auth0Enabled: getOsEnv("AUTH0_ENABLED") === "true",
  auth0Domain: getOsEnvOptional("AUTH0_DOMAIN") ?? "",
  auth0ClientId: getOsEnvOptional("AUTH0_CLIENT_ID") ?? "",
  auth0Audience: getOsEnvOptional("AUTH0_AUDIENCE") ?? "",
  /** Password reset token TTL (ms). */
  resetTokenTtlMs: 1000 * 60 * 60, // 1h
} as const;
