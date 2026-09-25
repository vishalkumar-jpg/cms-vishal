import { doublePrecision, index, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * A single actionable Lighthouse finding captured onto a `page_audits` row
 * (the `audits` map of the LHR, filtered to imperfect + applicable items). This
 * is what powers the "recommendations" the admin sees per audit.
 */
export interface PageAuditRecommendation {
  /** Lighthouse audit id (e.g. `unused-css-rules`, `uses-optimized-images`). */
  id: string;
  title: string;
  description: string;
  /** Owning Lighthouse category: performance | accessibility | seo | best-practices. */
  category: string;
  /** 0..1 audit score (always < 1 here; passing/N-A/informative items are dropped). */
  score: number | null;
  /** Human display value (e.g. "Potential savings of 120 KiB"). */
  displayValue?: string;
  /** Estimated savings from `details.overallSavingsMs` (ms). */
  savingsMs?: number;
  /** Estimated savings from `details.overallSavingsBytes` (bytes). */
  savingsBytes?: number;
  /** Number of affected elements (from the LHR audit `details.items`). */
  affectedCount?: number;
  /** A small sample of affected element identifiers (urls / selectors). */
  affectedSamples?: string[];
}

/**
 * Monitoring hub (backlog #29/#37/#30). Two new tenant-scoped tables:
 *   - `runtime_errors` — deduped client/server error reports (#37).
 *   - `page_audits`    — page-audit / certification score rows (#30).
 *
 * NOTE: CRM-delivery monitoring (#29) does NOT add a table — it READS the
 * existing forms→CRM delivery state-machine on `form_submissions`
 * (status/deliveryAttempts/lastError/deliveredAt). There is no separate
 * `crm_sync_log` table in this codebase; `form_submissions` IS the sync log.
 */

/**
 * `runtime_errors` (prefix `rte`) — captured runtime errors from the renderer,
 * admin SPA or API (#37). Deduped by (siteId, source, message, url): a repeat of
 * the same error increments `count` + bumps `lastSeen` instead of inserting a
 * new row, so a noisy error doesn't flood the table.
 */
export const runtimeErrors = obCmsSchema.table(
  "runtime_errors",
  {
    ...baseColumns("rte"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** 'renderer' | 'admin' | 'api' — where the error originated. */
    source: varchar({ length: 20 }).notNull().default("renderer"),
    message: varchar({ length: 2000 }).notNull(),
    stack: varchar({ length: 8000 }),
    url: varchar({ length: 2000 }),
    userAgent: varchar({ length: 1000 }),
    count: integer().notNull().default(1),
    firstSeen: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rte_site_lastseen_idx").on(t.siteId, t.lastSeen),
    // Dedupe lookup: same site+source+message+url → increment count.
    index("rte_dedupe_idx").on(t.siteId, t.source, t.message, t.url),
  ],
);

export type RuntimeErrorRow = typeof runtimeErrors.$inferSelect;
export type NewRuntimeErrorRow = typeof runtimeErrors.$inferInsert;

/**
 * `page_audits` (prefix `pau`) — page-audit / certification score rows (#30).
 * One row per audit run for a page path. Scores are 0..100 (Lighthouse scale).
 *
 * The worker runs REAL Lighthouse and writes the four category scores, Core Web
 * Vitals and the normalized `recommendations` with `status = 'completed'` (or
 * `skipped` when no headless Chromium is available). `POST /monitoring/audits/run`
 * audits one path; `POST /monitoring/audits/scan-all` enqueues one row per
 * published page, all sharing a `batchId`. Legacy rows may still carry the
 * historical `status = 'seam'`. See apps/api/PAGE-AUDITS-LIGHTHOUSE.md.
 */
export const pageAudits = obCmsSchema.table(
  "page_audits",
  {
    ...baseColumns("pau"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** The audited page's id (optional) + its public path (e.g. `/pricing`). */
    pageId: varchar({ length: 50 }),
    path: varchar({ length: 500 }).notNull(),
    /** 'seam' | 'pending' | 'running' | 'completed' | 'skipped' | 'failed'. */
    status: varchar({ length: 20 }).notNull().default("seam"),
    performanceScore: integer(),
    accessibilityScore: integer(),
    seoScore: integer(),
    bestPracticesScore: integer(),
    /** Core Web Vitals: LCP in ms, CLS unitless. */
    lcp: doublePrecision(),
    cls: doublePrecision(),
    /** Normalized actionable Lighthouse findings (opportunities + diagnostics). */
    recommendations: jsonb().$type<PageAuditRecommendation[]>(),
    /** Groups every row from one "scan all pages" bulk run (null for single runs). */
    batchId: varchar({ length: 50 }),
    /** Failure/skip reason written by the worker (null on completed audits). */
    detail: varchar({ length: 500 }),
    ranAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pau_site_path_idx").on(t.siteId, t.path, t.ranAt),
    index("pau_site_ranat_idx").on(t.siteId, t.ranAt),
    // Bulk-scan progress aggregate: rows sharing a batchId for the active site.
    index("pau_site_batch_idx").on(t.siteId, t.batchId),
  ],
);

export type PageAuditRow = typeof pageAudits.$inferSelect;
export type NewPageAuditRow = typeof pageAudits.$inferInsert;
