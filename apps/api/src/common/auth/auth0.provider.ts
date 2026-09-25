import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { JwtPayload } from "@ob-cms/shared";
import { authConfig } from "@config/auth.config";
import type { AuthProvider } from "./auth-provider.interface";

/**
 * Auth0 adapter — WIRED BUT INERT (TECH-ARCHITECTURE §5, standing assumption).
 *
 * Until OfficeBeacon's Auth0 tenant/client are provided and `AUTH0_ENABLED=true`
 * with creds, this provider reports disabled and refuses to verify. The
 * intended implementation (left as a stub on purpose — do NOT require creds):
 *   - fetch the tenant JWKS from `https://{auth0Domain}/.well-known/jwks.json`
 *   - verify RS256 signature + `aud`/`iss` against authConfig
 *   - map Auth0 `sub`/`email`/custom claims → our JwtPayload
 *   - reconcile/JIT-provision a systemUsers row + memberships.
 */
@Injectable()
export class Auth0Provider implements AuthProvider {
  readonly name = "auth0" as const;

  isEnabled(): boolean {
    return (
      authConfig.auth0Enabled &&
      Boolean(authConfig.auth0Domain) &&
      Boolean(authConfig.auth0ClientId)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyToken(_token: string): JwtPayload {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException("Auth0 provider is not enabled");
    }
    // Stub: real JWKS verification lands when OB's Auth0 creds are provided.
    throw new ServiceUnavailableException("Auth0 verification not implemented");
  }
}
