import { doublePrecision, index, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * Phase 5 — Marketing attribution. A durable conversion event (a goal / form
 * submit / named conversion, optionally carrying revenue `value`) recorded per
 * visitor. Attribution across a visitor's TOUCHPOINTS (derived on-read from
 * `analytics_events` — each session's source/medium/campaign/landing-path) is
 * computed by the module under first/last/linear models. Tenant-private
 * (siteId FK, cascade on site delete, ScopedRepository-guarded).
 */
export const attributionConversions = obCmsSchema.table(
  "attribution_conversions",
  {
    ...baseColumns("atc"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** Conversion time. */
    ts: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** First-party visitor id — the join key back to the touchpoint stream. */
    visitorId: varchar({ length: 60 }).notNull(),
    /** Resolved identity (nullable) if the visitor was known at conversion time. */
    identityId: varchar({ length: 50 }),
    /** Conversion kind: goal | form | event (free-form, defaults to "conversion"). */
    type: varchar({ length: 40 }).notNull().default("conversion"),
    /** Optional human label (e.g. the goal/form name) for the recent-list. */
    label: varchar({ length: 200 }),
    /** Optional monetary revenue attributed to this conversion (0 when unknown). */
    value: doublePrecision().notNull().default(0),
    /** The landing path of the converting session (denormalized for by-page). */
    landingPath: varchar({ length: 1000 }),
    /** Extra beacon context (kept small; no PII). */
    meta: jsonb().$type<Record<string, unknown>>(),
  },
  (t) => [
    index("atc_site_ts_idx").on(t.siteId, t.ts),
    index("atc_site_visitor_idx").on(t.siteId, t.visitorId),
  ],
);

export type AttributionConversionRow = typeof attributionConversions.$inferSelect;
export type NewAttributionConversionRow = typeof attributionConversions.$inferInsert;
