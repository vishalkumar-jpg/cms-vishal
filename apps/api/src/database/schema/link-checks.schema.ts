import { index, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * SITE-HEALTH — broken-link checker (two tenant-scoped tables):
 *   - `link_checks`  — one row per crawl RUN (status/summary counts).
 *   - `broken_links` — the non-2xx/3xx targets found by a run.
 *
 * The API enqueues a run (inserts a `running` `link_checks` row) and the worker
 * (`link-check.processor.ts`) crawls the site's published pages, extracts
 * `<a href>` targets, probes each unique target and records the broken ones.
 */

/**
 * `link_checks` (prefix `lkc`) — one crawl run for a site. Summary counters are
 * written by the worker when the run finishes (or fails). `status`:
 * `running | completed | failed`.
 */
export const linkChecks = obCmsSchema.table(
  "link_checks",
  {
    ...baseColumns("lkc"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    status: varchar({ length: 20 }).notNull().default("running"), // running|completed|failed
    /** Number of published pages the crawler fetched. */
    pagesCrawled: integer().notNull().default(0),
    /** Unique link targets probed. */
    linksChecked: integer().notNull().default(0),
    /** Broken targets recorded (non-2xx/3xx or dns/timeout). */
    brokenCount: integer().notNull().default(0),
    /** A human note when the run is skipped/failed (renderer unreachable, etc). */
    detail: varchar({ length: 1000 }),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("lkc_site_started_idx").on(t.siteId, t.startedAt)],
);

export type LinkCheckRow = typeof linkChecks.$inferSelect;
export type NewLinkCheckRow = typeof linkChecks.$inferInsert;

/**
 * `broken_links` (prefix `blk`) — one row per broken target discovered by a
 * run. `kind` is `internal` (resolved against the site base) or `external`.
 * `status` is the numeric HTTP status as a string, or `timeout` / `dns` /
 * `error` for network failures.
 */
export const brokenLinks = obCmsSchema.table(
  "broken_links",
  {
    ...baseColumns("blk"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    runId: varchar({ length: 50 }).notNull(),
    /** The published page path the broken link was found on (e.g. `/pricing`). */
    sourcePath: varchar({ length: 1000 }).notNull(),
    /** The (absolute) target URL that failed. */
    targetUrl: varchar({ length: 2000 }).notNull(),
    /** `internal` | `external`. */
    kind: varchar({ length: 10 }).notNull().default("external"),
    /** HTTP status as text, or `timeout` | `dns` | `error`. */
    status: varchar({ length: 20 }).notNull(),
    checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("blk_site_run_idx").on(t.siteId, t.runId),
    index("blk_run_idx").on(t.runId),
  ],
);

export type BrokenLinkRow = typeof brokenLinks.$inferSelect;
export type NewBrokenLinkRow = typeof brokenLinks.$inferInsert;
