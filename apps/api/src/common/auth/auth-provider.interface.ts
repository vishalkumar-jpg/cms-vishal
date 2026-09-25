import type { JwtPayload } from "@ob-cms/shared";

/**
 * Hybrid-auth abstraction (TECH-ARCHITECTURE §5). The active provider is a
 * per-tenant setting (`local` | `auth0`). For W1 only LOCAL is functional; the
 * Auth0 adapter is wired behind `AUTH0_ENABLED` but INERT (no creds required).
 *
 * Verifying an inbound bearer/cookie token is delegated to the provider so that,
 * when Auth0 is enabled for a tenant, Auth0-issued JWTs validate against the
 * Auth0 JWKS instead of the local secret — without touching the guards.
 */
export interface AuthProvider {
  readonly name: "local" | "auth0";
  /** True if this provider is configured and usable. */
  isEnabled(): boolean;
  /** Verify a token issued by this provider; throws on invalid. */
  verifyToken(token: string): Promise<JwtPayload> | JwtPayload;
}

export const AUTH_PROVIDER = Symbol("AUTH_PROVIDER");
