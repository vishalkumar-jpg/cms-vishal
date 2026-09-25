import { boolean, doublePrecision, index, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";
import { pages } from "./pages.schema";

/**
 * `page_comments` (prefix `cmt`) — builder collaboration comments (COLLAB).
 *
 * A comment is either a top-level thread root (`parentId` null) or a reply
 * (`parentId` → the root's id). `threadId` always points at the root of the
 * thread (a root's threadId == its own id) so a whole thread is one indexed
 * lookup. A thread may be anchored to a specific block via `nodeId`, or dropped
 * at a free canvas point (`anchorX`/`anchorY`, 0..1 fractions of the canvas box
 * so pins survive responsive reflow). `resolved` toggles a thread open/closed.
 *
 * Tenant-scoped (siteId) + soft-delete via baseColumns; loop-free by construction
 * (replies never nest beyond one level).
 */
export const pageComments = obCmsSchema.table(
  "page_comments",
  {
    ...baseColumns("cmt"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    pageId: varchar({ length: 50 })
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    // The thread root's id (== id for a root comment). Groups roots + replies.
    threadId: varchar({ length: 50 }).notNull(),
    // Null for a reply; a reply's parent is always the thread root.
    parentId: varchar({ length: 50 }),
    // The Craft node the pin is anchored to (null ⇒ free canvas point).
    nodeId: varchar({ length: 100 }),
    // Free-canvas anchor as 0..1 fractions of the canvas rect (null for node pins).
    anchorX: doublePrecision(),
    anchorY: doublePrecision(),
    body: varchar({ length: 4000 }).notNull(),
    authorId: varchar({ length: 50 }).notNull(),
    resolved: boolean().notNull().default(false),
  },
  (t) => [
    index("cmt_site_page_idx").on(t.siteId, t.pageId),
    index("cmt_thread_idx").on(t.threadId),
  ],
);

export type PageCommentRow = typeof pageComments.$inferSelect;
export type NewPageCommentRow = typeof pageComments.$inferInsert;
