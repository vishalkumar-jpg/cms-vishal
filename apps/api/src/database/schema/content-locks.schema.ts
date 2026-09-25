import { index, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `content_locks` (prefix `lck`) — CONTENT-OPS soft concurrent-edit locking.
 *
 * One live lock per (site, entityType, entityId). When an editor opens a page or
 * post in the builder we UPSERT a lock; the client heartbeats every ~30s. A lock
 * with no heartbeat for `LOCK_STALE_MS` (~2 min) is considered stale/free — the
 * next acquirer may steal it. Locking is ADVISORY: it never hard-blocks a save,
 * it only warns the second editor ("🔒 Jane is editing") and offers view-only /
 * take-over. Released on close (DELETE) or when it goes stale.
 *
 * - UNIQUE(siteId, entityType, entityId) — at most one lock row per entity.
 * - `heartbeatAt` drives staleness; `acquiredAt` is when the current holder took it.
 */
export const contentLocks = obCmsSchema.table(
  "content_locks",
  {
    ...baseColumns("lck"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    entityType: varchar({ length: 10 }).notNull(), // page | post
    entityId: varchar({ length: 50 }).notNull(),
    userId: varchar({ length: 50 }).notNull(),
    userName: varchar({ length: 200 }).notNull(),
    acquiredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    heartbeatAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("lck_site_entity_uq").on(t.siteId, t.entityType, t.entityId),
    index("lck_site_entity_idx").on(t.siteId, t.entityType, t.entityId),
  ],
);

export type ContentLockRow = typeof contentLocks.$inferSelect;
export type NewContentLockRow = typeof contentLocks.$inferInsert;
