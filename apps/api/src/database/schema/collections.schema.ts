import { index, jsonb, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * Dynamic content types (a HubDB / WP-CPT equivalent).
 *
 * `collections` (prefix `col`) — a per-site, marketer-defined content type with
 * a field schema and optional shared `detailLayout` (ADR 0001). `collection_items`
 * hold the actual rows (`data` only — items never own Craft layouts). Both are
 * tenant-private (siteId NOT NULL) so every read/write goes through the
 * ScopedRepository hard predicate, exactly like forms/pages.
 */

/** A single field in a collection's schema (stored in `collections.fields`). */
export interface CollectionFieldDef {
  key: string;
  label: string;
  type: "text" | "richtext" | "number" | "boolean" | "image" | "date" | "reference";
  required?: boolean;
}

export const collections = obCmsSchema.table(
  "collections",
  {
    ...baseColumns("col"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 200 }).notNull(),
    /** Array of CollectionFieldDef describing the item shape. */
    fields: jsonb().$type<CollectionFieldDef[]>().notNull().default([]),
    /**
     * Shared detail page layout for `/c/{collection}/{item}`.
     * Validated as SerializedLayout on write (same path as pages.draftLayout).
     * Null → renderer uses the generic field fallback.
     */
    detailLayout: jsonb().$type<SerializedLayout>(),
  },
  (t) => [
    unique("col_site_slug_uq").on(t.siteId, t.slug),
    unique("col_site_name_uq").on(t.siteId, t.name),
    index("col_site_idx").on(t.siteId),
  ],
);

export type CollectionRow = typeof collections.$inferSelect;
export type NewCollectionRow = typeof collections.$inferInsert;

export const collectionItems = obCmsSchema.table(
  "collection_items",
  {
    ...baseColumns("cit"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    collectionId: varchar({ length: 50 })
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    slug: varchar({ length: 200 }).notNull(),
    /** Field values keyed by the collection's field keys. */
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: varchar({ length: 20 }).notNull().default("draft"), // draft | published
    publishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    unique("cit_collection_slug_uq").on(t.collectionId, t.slug),
    index("cit_site_collection_idx").on(t.siteId, t.collectionId),
    index("cit_collection_status_idx").on(t.collectionId, t.status),
  ],
);

export type CollectionItemRow = typeof collectionItems.$inferSelect;
export type NewCollectionItemRow = typeof collectionItems.$inferInsert;
