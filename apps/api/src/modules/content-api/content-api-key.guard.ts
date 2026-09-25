import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { Request } from "express";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { apiKeys } from "@database/schema";
import { hashApiKey, safeHashEqual } from "./api-key.util";

/** The request shape after a successful Content-API-key authentication. */
export interface ContentApiRequest extends Request {
  contentApiSiteId?: string;
  contentApiKeyId?: string;
}

/**
 * ContentApiKeyGuard — authenticates a `Authorization: Bearer <key>` against the
 * `api_keys` table for the PUBLIC Content API (E27).
 *
 * The KEY IS THE TENANT: the active site is taken from the matched key's
 * `siteId`, never from a client header — so a key can only ever read its own
 * site's content (no cross-tenant access). Controllers using this guard are also
 * marked `@Public` so the cookie/JWT + tenant guards skip them entirely.
 *
 * Auth model: hash the presented token (SHA-256) and constant-time match the
 * stored `keyHash`. Revoked (`revokedAt`) or soft-deleted keys are rejected.
 * `lastUsedAt` is stamped best-effort (fire-and-forget) for light usage audit.
 */
@Injectable()
export class ContentApiKeyGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ContentApiRequest>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException("API key required");

    const presentedHash = hashApiKey(token);
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, presentedHash), isNull(apiKeys.deletedAt)))
      .limit(1);

    // Constant-time recheck (the indexed lookup above already matched, but the
    // explicit compare keeps the auth decision uniform and side-channel-safe).
    if (!row || !safeHashEqual(row.keyHash, presentedHash)) {
      throw new UnauthorizedException("Invalid API key");
    }
    if (row.revokedAt) throw new UnauthorizedException("API key revoked");

    req.contentApiSiteId = row.siteId;
    req.contentApiKeyId = row.id;

    // Light usage audit — never block the request on this write.
    void this.stampLastUsed(row.id);

    return true;
  }

  /** Best-effort `last_used_at` stamp — failures are swallowed (audit only). */
  private async stampLastUsed(id: string): Promise<void> {
    try {
      await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
    } catch {
      /* ignore — usage stamping must never affect the request */
    }
  }

  private extractToken(req: Request): string | undefined {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || undefined;
    return undefined;
  }
}
