import { doublePrecision, index, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `analytics_events` (prefix `aev`) — raw, first-party, privacy-friendly event
 * stream (Phase 2a). One row per beacon: a pageview, a web-vitals metric, or a
 * custom event. NO PII, NO cross-site identifiers — `visitorId` is a random
 * first-party id (cookie/localStorage) and IPs are never stored. TTL-friendly:
 * rows are aggregated into `analytics_daily` by the hourly rollup and can be
 * pruned after the rollup window (web-vitals percentiles query events directly).
 */
export const analyticsEvents = obCmsSchema.table(
  "analytics_events",
  {
    ...baseColumns("aev"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** Event time (server receipt time). */
    ts: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** pageview | web-vitals | event */
    type: varchar({ length: 20 }).notNull(),
    /** Normalized request path (no query string, no PII). */
    path: varchar({ length: 1000 }).notNull().default("/"),
    referrer: varchar({ length: 1000 }),
    /** Derived acquisition channel: direct | organic | referral | social | campaign. */
    source: varchar({ length: 20 }).notNull().default("direct"),
    medium: varchar({ length: 120 }),
    campaign: varchar({ length: 200 }),
    /** First-party random visitor id (NOT cross-site). */
    visitorId: varchar({ length: 60 }).notNull(),
    /** Session id (30-min inactivity window, client-derived). */
    sessionId: varchar({ length: 60 }).notNull(),
    /** desktop | mobile | tablet */
    deviceType: varchar({ length: 10 }).notNull().default("desktop"),
    /** For type=web-vitals: LCP | CLS | INP. */
    metric: varchar({ length: 10 }),
    /** For type=web-vitals: the metric value (ms for LCP/INP, unitless for CLS). */
    value: doublePrecision(),
    /** Optional custom-event name (type=event). E.g. "exposure" | "conversion". */
    name: varchar({ length: 120 }),
    /**
     * Phase 4 A/B testing: the experiment id this event belongs to, for
     * `name="exposure"` / `name="conversion"` events. Null for all other events.
     */
    experimentId: varchar({ length: 50 }),
    /** Phase 4 A/B testing: the assigned variant key ("A"/"B"/…). */
    variant: varchar({ length: 20 }),
  },
  (t) => [
    index("aev_site_ts_idx").on(t.siteId, t.ts),
    index("aev_site_type_ts_idx").on(t.siteId, t.type, t.ts),
    // Fast experiment results rollup: per (site, experiment, name/variant).
    index("aev_site_experiment_idx").on(t.siteId, t.experimentId),
  ],
);

/**
 * `analytics_daily` (prefix `adl`) — per-(site, day, path) rollup so the stats
 * API is fast. The hourly worker rollup upserts these idempotently from recent
 * `analytics_events`. `visitors` is a distinct visitor count for the (day,path),
 * `sessions` a distinct session count; `sources`/`devices` are jsonb count maps
 * keyed by channel/device so overview/sources/devices resolve without scanning
 * raw events.
 */
export const analyticsDaily = obCmsSchema.table(
  "analytics_daily",
  {
    ...baseColumns("adl"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** UTC calendar day, YYYY-MM-DD. */
    day: varchar({ length: 10 }).notNull(),
    path: varchar({ length: 1000 }).notNull().default("/"),
    pageviews: integer().notNull().default(0),
    /** Distinct visitors for this (day, path). */
    visitors: integer().notNull().default(0),
    /** Distinct sessions for this (day, path). */
    sessions: integer().notNull().default(0),
    /** Sum of session durations (seconds) observed for this (day, path). */
    sessionSeconds: integer().notNull().default(0),
    /** Count of single-pageview sessions (for bounce rate). */
    bouncedSessions: integer().notNull().default(0),
    /** { direct, organic, referral, social, campaign } → visitor counts. */
    sources: jsonb().$type<Record<string, number>>().notNull().default({}),
    /** { desktop, mobile, tablet } → visitor counts. */
    devices: jsonb().$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [
    index("adl_site_day_idx").on(t.siteId, t.day),
    index("adl_site_day_path_idx").on(t.siteId, t.day, t.path),
  ],
);

export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEventRow = typeof analyticsEvents.$inferInsert;
export type AnalyticsDailyRow = typeof analyticsDaily.$inferSelect;
export type NewAnalyticsDailyRow = typeof analyticsDaily.$inferInsert;
