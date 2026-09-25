import { index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `notifications` (prefix `ntf`) — in-app notifications for the header bell.
 *
 * One row per (recipient, event). Site-scoped (siteId) + soft-delete via
 * baseColumns. A notification is delivered to exactly ONE recipient
 * (`recipientUserId`); fan-out (e.g. a comment notifying several thread
 * participants) is N rows. `readAt` null ⇒ unread (drives the badge count).
 *
 * `entityType`/`entityId` point at the source object (a page / page_comment) and
 * `link` is a ready-to-navigate admin path for click-through. `actorUserId` is
 * who caused the notification (the commenter / reviewer), null for system events.
 *
 * Notifications are BEST-EFFORT side-effects of the source action (comment /
 * editorial workflow) — a write here never blocks the source mutation.
 */
export const notifications = obCmsSchema.table(
  "notifications",
  {
    ...baseColumns("ntf"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    // The user who SEES this notification (queries are always scoped to == me).
    recipientUserId: varchar({ length: 50 }).notNull(),
    // e.g. comment.added | comment.reply | comment.mention | review.requested |
    // review.approved | review.rejected.
    type: varchar({ length: 40 }).notNull(),
    title: varchar({ length: 300 }).notNull(),
    body: varchar({ length: 2000 }),
    // The source object (for click-through / dedupe).
    entityType: varchar({ length: 40 }),
    entityId: varchar({ length: 50 }),
    // A ready admin path, e.g. /pages/pag_123 or /pages/pag_123#cmt_456.
    link: varchar({ length: 500 }),
    // Who caused it (commenter / reviewer). Null for system events.
    actorUserId: varchar({ length: 50 }),
    // Null ⇒ unread. Set by mark-read / mark-all-read.
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    // The core query: a user's recent notifications, newest first + unread filter.
    index("ntf_site_recipient_idx").on(t.siteId, t.recipientUserId, t.createdAt),
    index("ntf_site_recipient_read_idx").on(t.siteId, t.recipientUserId, t.readAt),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
