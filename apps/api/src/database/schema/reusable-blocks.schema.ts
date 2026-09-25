import { index, jsonb, varchar } from "drizzle-orm/pg-core";
import type {
  ComponentProp,
  ComponentVariant,
  SerializedLayout,
} from "@ob-cms/block-schema";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `reusableBlocks` (prefix `rub`) — REUSE-BLOCKS. A named, per-site reusable
 * block: a self-contained `SerializedLayout` fragment (its OWN root) that pages
 * reference (not copy) via a `ReusableBlock` block. Editing this row updates
 * EVERY instance ("edit once, update everywhere"). Distinct from page_templates,
 * which are one-time COPIES.
 *
 * `siteId` is NOT NULL (tenant-private) so all reads/writes go through the
 * ScopedRepository's hard predicate, exactly like forms/pages.
 */
export const reusableBlocks = obCmsSchema.table(
  "reusable_blocks",
  {
    ...baseColumns("rub"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    /** A self-contained SerializedLayout (own root) for the saved fragment. */
    layout: jsonb().$type<SerializedLayout>().notNull(),
    /**
     * COMPONENTS — a reusable block upgraded into a design-system component. The
     * layout may flag named Slot nodes + bind node props to these declared props
     * (`componentBinding`). `props`/`variants` default to `[]`/`null` so existing
     * rows (plain reusable blocks) keep resolving exactly as before.
     */
    props: jsonb().$type<ComponentProp[]>(),
    variants: jsonb().$type<ComponentVariant[]>(),
  },
  (t) => [index("rub_site_idx").on(t.siteId)],
);

export type ReusableBlockRow = typeof reusableBlocks.$inferSelect;
export type NewReusableBlockRow = typeof reusableBlocks.$inferInsert;
