import { index, jsonb, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `pageTemplates` (prefix `tpl`) — reusable page/section presets. `siteId` is
 * NULLABLE: a NULL row is a GLOBAL preset available to every site; a non-NULL row
 * is a tenant-private template. `kind` ∈ page | section. `layout` is a
 * `SerializedLayout` fragment inserted into the builder.
 *
 * NOTE: because `siteId` is nullable (global presets), reads can't go through the
 * ScopedRepository's hard predicate; the service explicitly ORs
 * `siteId = ctx.siteId OR siteId IS NULL` and only WRITES tenant-owned rows.
 */
export const pageTemplates = obCmsSchema.table(
  "page_templates",
  {
    ...baseColumns("tpl"),
    siteId: varchar({ length: 50 }).references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    kind: varchar({ length: 20 }).notNull().default("page"), // page | section
    layout: jsonb().notNull(),
  },
  (t) => [index("tpl_site_kind_idx").on(t.siteId, t.kind)],
);

export type PageTemplateRow = typeof pageTemplates.$inferSelect;
export type NewPageTemplateRow = typeof pageTemplates.$inferInsert;
