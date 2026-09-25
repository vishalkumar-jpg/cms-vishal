import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { backups, type BackupRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { StorageService } from "@modules/media/storage.service";
import { QueueService } from "@modules/queue/queue.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";

/**
 * Platform-level database backup operations (gap E26). EVERY caller is GUARDED
 * upstream by {@link PlatformAdminGuard} (the controller is `@PlatformAdmin()`),
 * so these intentionally query the raw `db` cross-tenant — a backup is a dump of
 * the WHOLE cluster, never site-scoped.
 *
 * The API only manages the ledger + enqueues work; the heavy lifting (pg_dump /
 * pg_restore via spawn) happens in the worker so the API never blocks or needs
 * the Postgres client binaries. See apps/api/BACKUPS.md.
 */
@Injectable()
export class BackupsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  /** All backups, newest first (soft-deleted excluded). */
  list(): Promise<BackupRow[]> {
    return this.db
      .select()
      .from(backups)
      .where(isNull(backups.deletedAt))
      .orderBy(desc(backups.createdAt));
  }

  /**
   * Trigger a MANUAL backup: insert a `pending` row, enqueue the worker run job,
   * and return the row immediately (the worker fills size/status/storageKey).
   */
  async trigger(actor: AuthUser): Promise<BackupRow> {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const [row] = await this.db
      .insert(backups)
      .values({
        filename: `ob-cms-${ts}.sql.gz`,
        status: "pending",
        kind: "manual",
        createdBy: actor.userId,
      })
      .returning();

    await this.queue.enqueueBackupRun({ backupId: row.id });
    await this.audit.record({
      actorId: actor.userId,
      action: "platform.backup.created",
      category: "settings",
      entityType: "backup",
      entityId: row.id,
      metadata: { kind: "manual", filename: row.filename },
    });
    return row;
  }

  /**
   * Enqueue a RESTORE for a completed backup. The controller has already
   * validated the explicit `confirm` flag. We re-check the row is restorable,
   * loudly audit the destructive action, then enqueue.
   */
  async restore(id: string, actor: AuthUser): Promise<{ enqueued: true; backupId: string }> {
    const row = await this.requireRow(id);
    if (row.status !== "completed" || !row.storageKey) {
      throw new BadRequestException("Only a completed backup with a stored dump can be restored");
    }

    await this.audit.record({
      actorId: actor.userId,
      action: "platform.backup.restore_requested",
      category: "settings",
      entityType: "backup",
      entityId: row.id,
      // Loud, durable trail for a destructive op (restore overwrites live data).
      metadata: { filename: row.filename, storageKey: row.storageKey, destructive: true },
    });
    await this.queue.enqueueBackupRestore({ backupId: row.id });
    return { enqueued: true, backupId: row.id };
  }

  /** Delete the dump object (best-effort) + soft-delete the ledger row. */
  async remove(id: string, actor: AuthUser): Promise<{ deleted: true }> {
    const row = await this.requireRow(id);
    if (row.storageKey) {
      try {
        await this.storage.delete(row.storageKey, "privateBackups");
      } catch {
        // Best-effort: the object may already be gone / storage unreachable.
        // We still remove the ledger row so it doesn't linger as a dangling entry.
      }
    }
    await this.db
      .update(backups)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(eq(backups.id, id));
    await this.audit.record({
      actorId: actor.userId,
      action: "platform.backup.deleted",
      category: "settings",
      entityType: "backup",
      entityId: id,
      metadata: { filename: row.filename },
    });
    return { deleted: true };
  }

  /** A short-lived download URL for the dump (presigned GET). */
  async downloadUrl(id: string): Promise<{ url: string; filename: string }> {
    const row = await this.requireRow(id);
    if (row.status !== "completed" || !row.storageKey) {
      throw new BadRequestException("Backup is not available for download");
    }
    return {
      url: await this.storage.presignDownload(row.storageKey, 900, "privateBackups"),
      filename: row.filename,
    };
  }

  private async requireRow(id: string): Promise<BackupRow> {
    const [row] = await this.db
      .select()
      .from(backups)
      .where(and(eq(backups.id, id), isNull(backups.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException("Backup not found");
    return row;
  }
}
