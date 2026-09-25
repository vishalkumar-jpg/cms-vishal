import { jsonb, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `themes` (prefix `thm`) — 1:1 with a site (unique `siteId`). Design tokens that
 * feed BOTH the builder and the renderer as CSS variables. `preset` names a base
 * theme; `tokens` overrides colors/spacing/typography; `brand` holds logo/name.
 */
export const themes = obCmsSchema.table("themes", {
  ...baseColumns("thm"),
  siteId: varchar({ length: 50 })
    .notNull()
    .unique()
    .references(() => sites.id, { onDelete: "cascade" }),
  preset: varchar({ length: 60 }).notNull().default("default"),
  tokens: jsonb().notNull().default({}),
  brand: jsonb().notNull().default({}),
});

export type ThemeRow = typeof themes.$inferSelect;
export type NewThemeRow = typeof themes.$inferInsert;
