import { index, integer, jsonb, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * Phase 3 — Identity & audiences (the B2B intelligence layer). Built on the
 * Phase-2 analytics stream: `visitor_profiles` are aggregated from
 * `analytics_events` per `visitorId` by a worker job; an `identify` event (an
 * email fired after a form submit) creates an `identity` + (for a business
 * domain) a `company`, and the recompute job applies `scoring_rules` → a score.
 * All tables are tenant-private (siteId FK, ScopedRepository-guarded).
 */

/**
 * `companies` (prefix `cmp`) — a B2B account identified by email DOMAIN. Upserted
 * when an identified visitor's email is a business domain (not a free provider).
 * industry/size are an ENRICHMENT SEAM (nullable; no external API calls here).
 */
export const companies = obCmsSchema.table(
  "companies",
  {
    ...baseColumns("cmp"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** The email domain (lowercased), unique per site — the natural key. */
    domain: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }),
    /** Enrichment seam (nullable — no external enrichment API is called here). */
    industry: varchar({ length: 120 }),
    /** Enrichment seam: employee-count band, e.g. "1-10", "11-50" (nullable). */
    size: varchar({ length: 40 }),
  },
  (t) => [uniqueIndex("cmp_site_domain_uidx").on(t.siteId, t.domain)],
);

/**
 * `identities` (prefix `idt`) — a known person, keyed by `primaryEmail` (unique
 * per site). Created/linked by the identify path. Optionally linked to a
 * `company` (by business-domain).
 */
export const identities = obCmsSchema.table(
  "identities",
  {
    ...baseColumns("idt"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    primaryEmail: varchar({ length: 320 }).notNull(),
    name: varchar({ length: 255 }),
    companyId: varchar({ length: 50 }).references(() => companies.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("idt_site_email_uidx").on(t.siteId, t.primaryEmail)],
);

/**
 * `visitor_profiles` (prefix `vpr`) — one row per first-party `visitorId`,
 * aggregated from `analytics_events` by the recompute worker job (idempotent
 * upsert on (siteId, visitorId)). `identityId` is linked once the visitor is
 * identified; `score` is written by the scoring pass.
 */
export const visitorProfiles = obCmsSchema.table(
  "visitor_profiles",
  {
    ...baseColumns("vpr"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    visitorId: varchar({ length: 60 }).notNull(),
    firstSeen: timestamp({ withTimezone: true }),
    lastSeen: timestamp({ withTimezone: true }),
    sessions: integer().notNull().default(0),
    pageviews: integer().notNull().default(0),
    lastSource: varchar({ length: 20 }),
    lastDevice: varchar({ length: 10 }),
    /** Top paths by pageviews: `[{ path, views }]` (capped in the rollup). */
    topPaths: jsonb().$type<Array<{ path: string; views: number }>>().notNull().default([]),
    /** Set once the visitor is identified (linked to an identity/email). */
    identityId: varchar({ length: 50 }).references(() => identities.id, { onDelete: "set null" }),
    /** Lead score from applying active scoring_rules (recompute pass). */
    score: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex("vpr_site_visitor_uidx").on(t.siteId, t.visitorId),
    index("vpr_site_score_idx").on(t.siteId, t.score),
    index("vpr_site_lastseen_idx").on(t.siteId, t.lastSeen),
    index("vpr_site_identity_idx").on(t.siteId, t.identityId),
  ],
);

/**
 * `scoring_rules` (prefix `scr`) — admin-defined lead-scoring rules. Each rule is
 * a single condition `{ field, op, value }` worth `points` when it matches a
 * profile. The recompute job sums the points of all matching ACTIVE rules → the
 * profile score. Fields: pageviews | sessions | source | device | hasCompany |
 * isIdentified | visitedPath | score-less profile signals.
 */
export const scoringRules = obCmsSchema.table(
  "scoring_rules",
  {
    ...baseColumns("scr"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    /** condition: { field, op, value } — see ScoringCondition in the module. */
    condition: jsonb().$type<{ field: string; op: string; value?: string | number | boolean }>().notNull(),
    points: integer().notNull().default(0),
    active: varchar({ length: 5 }).notNull().default("true"),
  },
  (t) => [index("scr_site_idx").on(t.siteId)],
);

export type CompanyRow = typeof companies.$inferSelect;
export type NewCompanyRow = typeof companies.$inferInsert;
export type IdentityRow = typeof identities.$inferSelect;
export type NewIdentityRow = typeof identities.$inferInsert;
export type VisitorProfileRow = typeof visitorProfiles.$inferSelect;
export type NewVisitorProfileRow = typeof visitorProfiles.$inferInsert;
export type ScoringRuleRow = typeof scoringRules.$inferSelect;
export type NewScoringRuleRow = typeof scoringRules.$inferInsert;
