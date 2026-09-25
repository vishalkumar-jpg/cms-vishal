import { boolean, index, integer, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * Phase 4 — A/B experiments. An `experiments` row is a test on a site (optionally
 * scoped to a page) with a goal; `experiment_variants` are its weighted arms
 * ("A"/"B"/…). Assignment is DETERMINISTIC + STICKY per visitor
 * (`hash(visitorId + experimentId)` weighted by variant weights) so no
 * assignment rows are stored. Exposures + conversions are recorded on
 * `analytics_events` (the `experimentId`/`variant` dimensions) — the same
 * privacy-friendly, PII-free stream — and results are computed on-read. Both
 * tables are tenant-private (site_id FK, cascade on site delete).
 */

export const EXPERIMENT_STATUSES = ["draft", "running", "paused", "done"] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const GOAL_TYPES = ["pageview", "click", "form_submit"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const experiments = obCmsSchema.table(
  "experiments",
  {
    ...baseColumns("exp"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    description: varchar({ length: 500 }),
    /** Optional page this experiment targets (nullable = site-wide / block-level). */
    pageId: varchar({ length: 50 }),
    /** draft | running | paused | done */
    status: varchar({ length: 20 }).notNull().default("draft"),
    /** pageview | click | form_submit */
    goalType: varchar({ length: 20 }).notNull().default("pageview"),
    /** For goalType=pageview: the path that counts as a conversion. */
    goalPath: varchar({ length: 1000 }),
    startedAt: timestamp({ withTimezone: true }),
    /** Set when a winner is declared (nullable until then). */
    winnerVariantId: varchar({ length: 50 }),
  },
  (t) => [index("exp_site_idx").on(t.siteId), index("exp_site_status_idx").on(t.siteId, t.status)],
);

export const experimentVariants = obCmsSchema.table(
  "experiment_variants",
  {
    ...baseColumns("evr"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    experimentId: varchar({ length: 50 })
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    /** Stable variant key used by the deterministic split + beacons: "A"/"B"/… */
    key: varchar({ length: 20 }).notNull(),
    name: varchar({ length: 200 }).notNull(),
    /** Relative traffic weight (positive integer). Split is weight-proportional. */
    weight: integer().notNull().default(1),
    isControl: boolean().notNull().default(false),
  },
  (t) => [
    uniqueIndex("evr_experiment_key_uidx").on(t.experimentId, t.key),
    index("evr_site_experiment_idx").on(t.siteId, t.experimentId),
  ],
);

export type ExperimentRow = typeof experiments.$inferSelect;
export type NewExperimentRow = typeof experiments.$inferInsert;
export type ExperimentVariantRow = typeof experimentVariants.$inferSelect;
export type NewExperimentVariantRow = typeof experimentVariants.$inferInsert;
