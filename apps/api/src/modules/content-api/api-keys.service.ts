import { Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { apiKeys, type ApiKeyRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { generateApiKey } from "./api-key.util";
import type { CreateApiKeyDto } from "./dto/api-key.dto";

/** A safe (no-secret) projection of an API key row for admin listings. */
export type SafeApiKey = Omit<ApiKeyRow, "keyHash">;

export interface CreatedApiKey extends SafeApiKey {
  /** The full plaintext key — present ONLY in the create response, shown once. */
  plaintext: string;
}

/**
 * Admin management of Content-API keys (E27). Site-scoped via ScopedRepository.
 * Keys are minted server-side; the plaintext is returned ONCE on creation and
 * never stored — only its SHA-256 hash + a display prefix are persisted.
 */
@Injectable()
export class ApiKeysService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
  ) {}

  private safe(row: ApiKeyRow): SafeApiKey {
    const { keyHash: _keyHash, ...rest } = row;
    return rest;
  }

  async list(): Promise<SafeApiKey[]> {
    const rows = await this.repo.db
      .select()
      .from(apiKeys)
      .where(this.repo.scope(apiKeys))
      .orderBy(desc(apiKeys.createdAt))
      .limit(500);
    return rows.map((r) => this.safe(r));
  }

  async create(dto: CreateApiKeyDto, actor: AuthUser): Promise<CreatedApiKey> {
    const { plaintext, keyPrefix, keyHash } = generateApiKey();
    const [row] = await this.repo.db
      .insert(apiKeys)
      .values({
        ...this.repo.insertDefaults(),
        name: dto.name,
        keyPrefix,
        keyHash,
        scopes: ["read"],
      })
      .returning();
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "api_key.created",
      category: "settings",
      entityType: "api_key",
      entityId: row.id,
      metadata: { name: row.name, keyPrefix: row.keyPrefix },
    });
    // The ONLY time the plaintext leaves the server.
    return { ...this.safe(row), plaintext };
  }

  /** Revoke (soft) a key — it can no longer authenticate. Idempotent-ish. */
  async revoke(id: string, actor: AuthUser): Promise<SafeApiKey> {
    const [existing] = await this.repo.db
      .select()
      .from(apiKeys)
      .where(this.repo.scope(apiKeys, eq(apiKeys.id, id)))
      .limit(1);
    if (!existing) throw new NotFoundException("API key not found");
    const [row] = await this.repo.db
      .update(apiKeys)
      .set({ revokedAt: new Date(), deletedAt: new Date(), updatedBy: actor.userId })
      .where(this.repo.scope(apiKeys, eq(apiKeys.id, id)))
      .returning();
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "api_key.revoked",
      category: "settings",
      entityType: "api_key",
      entityId: id,
    });
    return this.safe(row);
  }
}
