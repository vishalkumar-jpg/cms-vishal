import { index, jsonb, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * Phase 3 — Audience segmentation. An `audience_definitions` row holds a
 * condition GROUP (AND/OR tree) over visitor-profile + identity fields
 * (pageviews, source, device, hasCompany, score>=, visitedPath, isIdentified,
 * locale, …). A worker recompute job evaluates each definition against
 * `visitor_profiles`/`identities` → `audience_memberships` (idempotent). Both
 * tables are tenant-private.
 */

/** The persisted rule shape (a RuleGroup mirror; see AudienceRuleGroup in the module). */
export interface AudienceRuleGroupJson {
  logic: "and" | "or";
  conditions: Array<
    | { field: string; op: string; value?: string | number | boolean }
    | AudienceRuleGroupJson
  >;
}

export const audienceDefinitions = obCmsSchema.table(
  "audience_definitions",
  {
    ...baseColumns("aud"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    description: varchar({ length: 500 }),
    /** The condition group (AND/OR tree) evaluated against profiles/identities. */
    rules: jsonb().$type<AudienceRuleGroupJson>().notNull(),
  },
  (t) => [index("aud_site_idx").on(t.siteId)],
);

/**
 * `audience_memberships` (prefix `ame`) — a materialized membership row per
 * (audience, visitorProfile). Rebuilt idempotently by the recompute job
 * (delete-all-then-insert per audience). `identityId` is denormalized for a fast
 * identified-member view.
 */
export const audienceMemberships = obCmsSchema.table(
  "audience_memberships",
  {
    ...baseColumns("ame"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    audienceId: varchar({ length: 50 })
      .notNull()
      .references(() => audienceDefinitions.id, { onDelete: "cascade" }),
    visitorProfileId: varchar({ length: 50 }).notNull(),
    visitorId: varchar({ length: 60 }).notNull(),
    identityId: varchar({ length: 50 }),
  },
  (t) => [
    uniqueIndex("ame_audience_profile_uidx").on(t.audienceId, t.visitorProfileId),
    index("ame_site_audience_idx").on(t.siteId, t.audienceId),
  ],
);

export type AudienceDefinitionRow = typeof audienceDefinitions.$inferSelect;
export type NewAudienceDefinitionRow = typeof audienceDefinitions.$inferInsert;
export type AudienceMembershipRow = typeof audienceMemberships.$inferSelect;
export type NewAudienceMembershipRow = typeof audienceMemberships.$inferInsert;
