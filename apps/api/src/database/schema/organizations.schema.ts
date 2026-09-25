import { index, jsonb, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";

/**
 * `organizations` (prefix `org`) — the top-level tenant grouping. One org can
 * own many `sites` (e.g. OfficeBeacon's many websites roll up under one org).
 * `plan` is a jsonb placeholder so billing/limits can bolt on later without a
 * schema change.
 */
export const organizations = obCmsSchema.table(
  "organizations",
  {
    ...baseColumns("org"),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 120 }).notNull().unique(),
    status: varchar({ length: 20 }).notNull().default("active"), // active | suspended | archived
    plan: jsonb().notNull().default({ tier: "free", limits: {} }),
  },
  (t) => [index("org_slug_idx").on(t.slug)],
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
