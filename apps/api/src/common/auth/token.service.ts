import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "@ob-cms/shared";
import { authConfig } from "@config/auth.config";

/**
 * Local JWT signer/verifier for the cookie session, plus opaque refresh-token
 * minting/hashing (C21). Wraps `jsonwebtoken` so the rest of the app never
 * touches the secret. Auth0-issued tokens are handled by the (inert) Auth0
 * adapter, not here.
 */
@Injectable()
export class TokenService {
  /** Sign a SHORT-lived (15m) access JWT for the `ob_session` cookie. */
  sign(payload: JwtPayload): string {
    return jwt.sign(payload, authConfig.jwtSecret, {
      expiresIn: authConfig.accessTokenExpiry as jwt.SignOptions["expiresIn"],
    });
  }

  /**
   * Mint a high-entropy opaque refresh token (NOT a JWT). The raw value goes in
   * the httpOnly `ob_refresh` cookie; only `hashRefresh(raw)` is persisted.
   */
  generateRefreshToken(): string {
    return randomBytes(32).toString("hex");
  }

  /** SHA-256 hash used to look up / store refresh tokens (never store raw). */
  hashRefresh(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  verify(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as jwt.JwtPayload & JwtPayload;
      return {
        sub: decoded.sub,
        email: decoded.email,
        isPlatformAdmin: Boolean(decoded.isPlatformAdmin),
      };
    } catch {
      throw new UnauthorizedException("Invalid or expired session");
    }
  }
}
