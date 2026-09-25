import { index, jsonb, unique, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `navigation` (prefix `nav`) — one menu tree per (site, location). `location`
 * ∈ header | footer | ... . `tree` is a nested jsonb array of menu items
 * ({ label, href, pageId?, children[] }). UNIQUE(siteId, location) → upsert.
 */
export const navigation = obCmsSchema.table(
  "navigation",
  {
    ...baseColumns("nav"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    location: varchar({ length: 40 }).notNull(), // header | footer | sidebar | ...
    tree: jsonb().notNull().default([]),
  },
  (t) => [
    unique("nav_site_location_uq").on(t.siteId, t.location),
    index("nav_site_idx").on(t.siteId),
  ],
);

export type NavigationRow = typeof navigation.$inferSelect;
export type NewNavigationRow = typeof navigation.$inferInsert;
