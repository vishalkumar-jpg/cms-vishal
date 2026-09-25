import { boolean, index, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `webhooks` (prefix `whk`) — per-site outbound webhook subscriptions (gap E27).
 * When a page/post is published (or a form is submitted) the API enqueues one
 * delivery job per matching active subscription; the worker POSTs the payload to
 * `url` with an HMAC `X-OBCMS-Signature` header signed with `secret`.
 */
export const webhooks = obCmsSchema.table(
  "webhooks",
  {
    ...baseColumns("whk"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    url: varchar({ length: 1000 }).notNull(),
    /** Event names this subscription wants, e.g. `page.published`, `post.published`. */
    events: jsonb().$type<string[]>().notNull().default([]),
    /** HMAC signing secret (shared with the subscriber to verify deliveries). */
    secret: varchar({ length: 200 }).notNull(),
    active: boolean().notNull().default(true),
  },
  (t) => [index("whk_site_idx").on(t.siteId)],
);

/**
 * `webhook_deliveries` (prefix `whd`) — an attempt log + retry ledger for each
 * delivery. The worker advances `status` (pending→delivered|failed|dead_lettered),
 * records `statusCode`/`attempts`, and stores `nextRetryAt` for the backoff.
 */
export const webhookDeliveries = obCmsSchema.table(
  "webhook_deliveries",
  {
    ...baseColumns("whd"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    webhookId: varchar({ length: 50 })
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: varchar({ length: 80 }).notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** pending | delivering | delivered | failed | dead_lettered */
    status: varchar({ length: 20 }).notNull().default("pending"),
    statusCode: integer(),
    attempts: integer().notNull().default(0),
    lastError: varchar({ length: 1000 }),
    deliveredAt: timestamp({ withTimezone: true }),
    nextRetryAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("whd_site_idx").on(t.siteId),
    index("whd_webhook_idx").on(t.webhookId),
  ],
);

export type WebhookRow = typeof webhooks.$inferSelect;
export type NewWebhookRow = typeof webhooks.$inferInsert;
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDeliveryRow = typeof webhookDeliveries.$inferInsert;
