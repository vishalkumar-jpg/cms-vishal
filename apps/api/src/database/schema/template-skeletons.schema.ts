import { index, integer, jsonb, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "@database/base-columns";
import { generateKSUIDWithPrefixSync } from "@utils/ksuid.utils";
import { obCmsSchema } from "./_schema";

/**
 * Platform template skeleton catalog — metadata row (no layout JSON).
 *
 * `templateKey` is the stable registry id (`tpl-homepage`, …). Internal `id`
 * is a prefixed KSUID. Content lives in `template_skeleton_contents` (1:1).
 *
 * NOT site-scoped: these are global platform starters. Reads do not use
 * ScopedRepository; writes are platform-admin guarded in the API.
 */
export const templateSkeletons = obCmsSchema.table(
  "template_skeletons",
  {
    ...baseColumns("tsk"),
    templateKey: varchar({ length: 100 }).notNull(),
    displayName: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    category: varchar({ length: 50 }).notNull(),
    tags: jsonb().$type<string[]>().notNull().default([]),
    supportedPageTypes: jsonb().$type<string[]>().notNull().default([]),
    previewMetadata: jsonb()
      .$type<{ thumbnail?: string; featured?: boolean; owner?: string }>()
      .notNull()
      .default({}),
    version: varchar({ length: 50 }).notNull(),
    status: varchar({ length: 20 }).notNull().default("draft"),
    /**
     * Metadata-row compatibility stamp — records which content payload shape this
     * skeleton expects. Authoritative on the metadata row; paired content carries
     * its own `contentSchemaVersion` (see templateSkeletonContents).
     */
    schemaVersion: varchar({ length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("tsk_template_key_active_uidx")
      .on(t.templateKey)
      .where(sql`deleted_at IS NULL`),
    index("tsk_status_idx").on(t.status),
    index("tsk_category_idx").on(t.category),
  ],
);

/**
 * Editable page structure for a template skeleton (1:1 with metadata row).
 * Separated so metadata queries stay lightweight and content can be versioned later.
 */
export const templateSkeletonContents = obCmsSchema.table(
  "template_skeleton_contents",
  {
    ...baseColumns("tsc"),
    skeletonId: varchar({ length: 50 })
      .notNull()
      .references(() => templateSkeletons.id, { onDelete: "cascade" }),
    layout: jsonb().notNull(),
    sections: jsonb().$type<unknown[]>().notNull().default([]),
    pageStructure: jsonb()
      .$type<{
        defaultSectionOrder: string[];
        requiredSectionIds: string[];
        optionalSectionIds: string[];
      }>()
      .notNull()
      .default({
        defaultSectionOrder: [],
        requiredSectionIds: [],
        optionalSectionIds: [],
      }),
    componentProps: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /**
     * Content-payload compatibility stamp — version of layout/sections/pageStructure
     * shape stored in this row. Distinct from metadata.schemaVersion; both default
     * to the same constant today but can diverge when content evolves independently.
     */
    contentSchemaVersion: varchar({ length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("tsc_skeleton_id_uidx")
      .on(t.skeletonId)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type TemplateSkeletonRow = typeof templateSkeletons.$inferSelect;
export type NewTemplateSkeletonRow = typeof templateSkeletons.$inferInsert;
export type TemplateSkeletonContentRow = typeof templateSkeletonContents.$inferSelect;
export type NewTemplateSkeletonContentRow = typeof templateSkeletonContents.$inferInsert;

/**
 * Preview asset metadata for a template skeleton (references only — no binary blobs).
 * Multiple gallery_image rows allowed; thumbnail/cover/icon/video_preview are singletons.
 */
export const templateSkeletonAssets = obCmsSchema.table(
  "template_skeleton_assets",
  {
    ...baseColumns("tsa"),
    skeletonId: varchar({ length: 50 })
      .notNull()
      .references(() => templateSkeletons.id, { onDelete: "cascade" }),
    assetType: varchar({ length: 30 }).notNull(),
    storageKey: varchar({ length: 500 }),
    url: varchar({ length: 2000 }).notNull(),
    mimeType: varchar({ length: 100 }),
    width: integer(),
    height: integer(),
    size: integer(),
    altText: varchar({ length: 500 }),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [
    index("tsa_skeleton_idx").on(t.skeletonId),
    index("tsa_skeleton_type_idx").on(t.skeletonId, t.assetType),
    uniqueIndex("tsa_skeleton_singleton_uidx")
      .on(t.skeletonId, t.assetType)
      .where(
        sql`deleted_at IS NULL AND asset_type IN ('thumbnail', 'cover_image', 'icon', 'video_preview')`,
      ),
  ],
);

export type TemplateSkeletonAssetRow = typeof templateSkeletonAssets.$inferSelect;
export type NewTemplateSkeletonAssetRow = typeof templateSkeletonAssets.$inferInsert;

/**
 * Immutable snapshot of a template skeleton at a published version.
 * Append-only — never updated or soft-deleted.
 */
export const templateSkeletonVersions = obCmsSchema.table(
  "template_skeleton_versions",
  {
    id: varchar({ length: 50 })
      .primaryKey()
      .$defaultFn(() => generateKSUIDWithPrefixSync("tsv")),
    skeletonId: varchar({ length: 50 })
      .notNull()
      .references(() => templateSkeletons.id, { onDelete: "cascade" }),
    templateKey: varchar({ length: 100 }).notNull(),
    version: varchar({ length: 50 }).notNull(),
    metadata: jsonb().$type<TemplateSkeletonVersionMetadataSnapshot>().notNull(),
    content: jsonb().$type<TemplateSkeletonVersionContentSnapshot>().notNull(),
    snapshotDigest: varchar({ length: 64 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: varchar({ length: 50 }),
  },
  (t) => [
    index("tsv_skeleton_created_idx").on(t.skeletonId, t.createdAt),
    index("tsv_skeleton_version_idx").on(t.skeletonId, t.version),
    index("tsv_template_key_idx").on(t.templateKey),
    uniqueIndex("tsv_skeleton_version_uidx").on(t.skeletonId, t.version),
  ],
);

/** Metadata fields frozen at snapshot time (excludes skeleton row ids/timestamps). */
export type TemplateSkeletonVersionMetadataSnapshot = {
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  supportedPageTypes: string[];
  previewMetadata: { thumbnail?: string; featured?: boolean; owner?: string };
  version: string;
  status: string;
  schemaVersion: string;
};

export type TemplateSkeletonVersionContentSnapshot = {
  contentSchemaVersion: string;
  layout: Record<string, unknown>;
  sections: unknown[];
  pageStructure: {
    defaultSectionOrder: string[];
    requiredSectionIds: string[];
    optionalSectionIds: string[];
  };
  componentProps: Record<string, unknown>;
};

export type TemplateSkeletonVersionRow = typeof templateSkeletonVersions.$inferSelect;
export type NewTemplateSkeletonVersionRow = typeof templateSkeletonVersions.$inferInsert;
