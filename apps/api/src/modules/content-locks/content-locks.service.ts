import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { contentLocks, type ContentLockRow } from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";

/** A lock is stale (free to steal) after this long without a heartbeat. */
export const LOCK_STALE_MS = 2 * 60 * 1000;

export type LockEntity = "page" | "post";

/** The lock view returned to the client. */
export interface LockView {
  /** Whether a LIVE lock is currently held (by anyone). */
  locked: boolean;
  /** The holder, if a live lock exists. */
  holder: {
    userId: string;
    userName: string;
    acquiredAt: string;
    heartbeatAt: string;
  } | null;
  /** True when the current caller is the holder. */
  mine: boolean;
}

/**
 * CONTENT-OPS — soft concurrent-edit locking (advisory).
 *
 * One row per (site, entityType, entityId). Acquire is an UPSERT that:
 *   - creates the lock if none exists,
 *   - refreshes the heartbeat if the caller already holds it,
 *   - STEALS it if the existing lock is STALE (no heartbeat for LOCK_STALE_MS),
 *   - STEALS it when `takeOver` is set (explicit user action),
 *   - otherwise returns the existing (live) holder without changing anything.
 *
 * Nothing here ever blocks a save — the caller decides how to react (view-only
 * vs take-over). Releases are best-effort (only the holder may release).
 */
@Injectable()
export class ContentLocksService {
  constructor(private readonly repo: ScopedRepository) {}

  /** Current lock state for an entity (treating stale locks as free). */
  async get(entityType: LockEntity, entityId: string, actor: AuthUser): Promise<LockView> {
    const row = await this.find(entityType, entityId);
    return this.toView(row, actor.userId);
  }

  /**
   * Acquire or heartbeat the lock. Returns the resulting lock view; `mine` is
   * true when the caller now holds it. When another user holds a LIVE lock and
   * `takeOver` is false, the caller does NOT get the lock (view is the other
   * holder, `mine=false`).
   */
  async acquire(
    entityType: LockEntity,
    entityId: string,
    actor: AuthUser,
    takeOver: boolean,
  ): Promise<LockView> {
    const existing = await this.find(entityType, entityId);
    const now = new Date();
    const stale = existing ? this.isStale(existing, now) : true;
    const heldByMe = existing?.userId === actor.userId;

    // Someone else holds a live lock and we're not stealing → return their view.
    if (existing && !heldByMe && !stale && !takeOver) {
      return this.toView(existing, actor.userId);
    }

    const userName = actor.email; // AuthUser carries no display name; email is the label.
    if (existing) {
      // Refresh (heartbeat) when mine, or STEAL (stale / explicit take-over).
      const acquiredAt = heldByMe && !takeOver ? existing.acquiredAt : now;
      const [row] = await this.repo.db
        .update(contentLocks)
        .set({
          userId: actor.userId,
          userName,
          acquiredAt,
          heartbeatAt: now,
          updatedBy: actor.userId,
        })
        .where(this.repo.scope(contentLocks, eq(contentLocks.id, existing.id)))
        .returning();
      return this.toView(row, actor.userId);
    }

    const [row] = await this.repo.db
      .insert(contentLocks)
      .values({
        ...this.repo.insertDefaults(),
        entityType,
        entityId,
        userId: actor.userId,
        userName,
        acquiredAt: now,
        heartbeatAt: now,
      })
      .returning();
    return this.toView(row, actor.userId);
  }

  /** Release the lock (only the current holder may). Idempotent. */
  async release(
    entityType: LockEntity,
    entityId: string,
    actor: AuthUser,
  ): Promise<{ ok: true }> {
    const existing = await this.find(entityType, entityId);
    if (existing && existing.userId === actor.userId) {
      await this.repo.db
        .delete(contentLocks)
        .where(this.repo.scope(contentLocks, eq(contentLocks.id, existing.id)));
    }
    return { ok: true };
  }

  // -- helpers ---------------------------------------------------------------

  private async find(
    entityType: LockEntity,
    entityId: string,
  ): Promise<ContentLockRow | undefined> {
    const [row] = await this.repo.db
      .select()
      .from(contentLocks)
      .where(
        this.repo.scope(
          contentLocks,
          and(eq(contentLocks.entityType, entityType), eq(contentLocks.entityId, entityId)),
        ),
      )
      .limit(1);
    return row;
  }

  private isStale(row: ContentLockRow, now: Date): boolean {
    return now.getTime() - row.heartbeatAt.getTime() > LOCK_STALE_MS;
  }

  private toView(row: ContentLockRow | undefined, callerId: string): LockView {
    if (!row || this.isStale(row, new Date())) {
      return { locked: false, holder: null, mine: false };
    }
    return {
      locked: true,
      holder: {
        userId: row.userId,
        userName: row.userName,
        acquiredAt: row.acquiredAt.toISOString(),
        heartbeatAt: row.heartbeatAt.toISOString(),
      },
      mine: row.userId === callerId,
    };
  }
}
