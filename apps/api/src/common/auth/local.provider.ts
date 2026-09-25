import { Injectable } from "@nestjs/common";
import type { JwtPayload } from "@ob-cms/shared";
import type { AuthProvider } from "./auth-provider.interface";
import { TokenService } from "./token.service";

/** Local email/password JWT provider — the functional default for W1. */
@Injectable()
export class LocalAuthProvider implements AuthProvider {
  readonly name = "local" as const;

  constructor(private readonly tokens: TokenService) {}

  isEnabled(): boolean {
    return true;
  }

  verifyToken(token: string): JwtPayload {
    return this.tokens.verify(token);
  }
}
