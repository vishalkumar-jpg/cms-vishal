import { bigint, index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";

/**
 * `backups` (prefix `bak`) — PLATFORM-level database backup ledger (gap E26).
 *
 * Cross-tenant / super-admin only: a backup is a full `pg_dump` of the whole
 * cluster, NOT site-scoped, so there is intentionally NO `siteId` column. The
 * row is created `pending` by the API when a backup is triggered (manual or by
 * the scheduled cron), then the worker's backup processor moves it through
 * `running` → `completed`/`failed`, recording the size + storage key.
 *
 * The dump bytes themselves live in object storage (S3/MinIO, key in
 * `storageKey`); this table is just the index + status ledger.
 */
export const backups = obCmsSchema.table(
  "backups",
  {
    ...baseColumns("bak"),
    /** Dump file name (e.g. `ob-cms-2026-06-29T12-00-00.sql.gz`). */
    filename: varchar({ length: 300 }).notNull(),
    /** Compressed dump size in bytes (filled by the worker when completed). */
    sizeBytes: bigint({ mode: "number" }),
    /** 'pending' | 'running' | 'completed' | 'failed'. */
    status: varchar({ length: 20 }).notNull().default("pending"),
    /** 'manual' (console button) | 'scheduled' (daily cron). */
    kind: varchar({ length: 20 }).notNull().default("manual"),
    /** Object-storage key for the uploaded dump (null until completed). */
    storageKey: varchar({ length: 500 }),
    /** Failure detail (e.g. "pg_dump binary not found") when status='failed'. */
    error: varchar({ length: 2000 }),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("bak_status_createdat_idx").on(t.status, t.createdAt)],
);

export type BackupRow = typeof backups.$inferSelect;
export type NewBackupRow = typeof backups.$inferInsert;
