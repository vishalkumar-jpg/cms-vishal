import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { auditLog } from "@database/schema";

export interface AuditRecord {
  siteId?: string | null;
  actorId?: string | null;
  action: string;
  category?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit writer (FND-25..27). Call `record()` from inside each
 * mutating service — ideally passing the transaction (`tx`) so the audit row
 * commits/rolls back with the change. There is intentionally NO update/delete.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(rec: AuditRecord, tx?: Database): Promise<void> {
    const exec = tx ?? this.db;
    await exec.insert(auditLog).values({
      siteId: rec.siteId ?? null,
      actorId: rec.actorId ?? null,
      action: rec.action,
      category: rec.category ?? null,
      entityType: rec.entityType ?? null,
      entityId: rec.entityId ?? null,
      metadata: rec.metadata ?? {},
      createdBy: rec.actorId ?? null,
    });
  }
}
