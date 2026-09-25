import { index, timestamp, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { organizations } from "./organizations.schema";
import { systemUsers } from "./system-users.schema";

/**
 * `sites` (prefix `ste`) — THE TENANT. One row per website. Almost every
 * downstream table carries `siteId` (FK → sites.id) and is read/written through
 * the ScopedRepository, which auto-injects `WHERE site_id = ctx.siteId`.
 *
 * - `visibility` drives whether the public runtime serves it.
 * - `subdomain`, `customDomain`, `primaryDomain` feed host-based resolution.
 */
export const sites = obCmsSchema.table(
  "sites",
  {
    ...baseColumns("ste"),
    orgId: varchar({ length: 50 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 120 }).notNull().unique(),
    subdomain: varchar({ length: 120 }).notNull().unique(),
    customDomain: varchar({ length: 255 }).unique(),
    primaryDomain: varchar({ length: 255 }),
    ownerId: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
    status: varchar({ length: 20 }).notNull().default("active"), // active | suspended
    visibility: varchar({ length: 20 }).notNull().default("draft"), // draft|preview|public|archived
    publishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("ste_org_idx").on(t.orgId),
    index("ste_subdomain_idx").on(t.subdomain),
    index("ste_custom_domain_idx").on(t.customDomain),
    index("ste_visibility_idx").on(t.visibility),
  ],
);

export type SiteRow = typeof sites.$inferSelect;
export type NewSiteRow = typeof sites.$inferInsert;
