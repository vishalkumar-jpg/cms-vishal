/**
 * Persisted template catalog schemas — read/browse projection over skeleton rows.
 *
 * Catalog entries expose skeleton metadata (+ optional preview asset summaries)
 * without layout/content JSON. Persistence remains {@link templateSkeletons};
 * this module defines the gallery/instantiate-facing contract only.
 *
 * Distinct from {@link ./catalog.ts} (in-memory builtin seed registry).
 *
 * @see docs/cms/template-skeleton-storage.md
 */
import { z } from "zod";
import {
  templateSkeletonAssetMimeTypeSchema,
  templateSkeletonAssetTypeSchema,
  templateSkeletonAssetUrlSchema,
} from "./asset-schema";
import { templateCategorySchema, templateStatusSchema } from "./schema";
import { templateKeySchema } from "./skeleton-schema";

const isoDateTimeSchema = z.string().datetime({
  offset: true,
  message: "Must be a valid ISO-8601 date-time string",
});

/** Catalog list/detail sort keys (applied by storage adapters in Phase 2B). */
export const TEMPLATE_CATALOG_SORT_VALUES = ["displayName", "updatedAt", "featured"] as const;

export type TemplateCatalogSort = (typeof TEMPLATE_CATALOG_SORT_VALUES)[number];

export const templateCatalogSortSchema = z.enum(TEMPLATE_CATALOG_SORT_VALUES);

/** Lightweight preview asset row for catalog gallery cards. */
export const templateCatalogAssetSummarySchema = z
  .object({
    id: z.string().min(1),
    assetType: templateSkeletonAssetTypeSchema,
    url: templateSkeletonAssetUrlSchema,
    mimeType: templateSkeletonAssetMimeTypeSchema.nullable().optional(),
    altText: z.string().min(1).nullable().optional(),
    sortOrder: z.number().int().nonnegative(),
  })
  .strict();

export type TemplateCatalogAssetSummary = z.infer<typeof templateCatalogAssetSummarySchema>;

/**
 * Catalog entry — skeleton metadata flattened for browse/filter UI.
 * No layout or section JSON.
 */
export const templateCatalogEntrySchema = z
  .object({
    id: z.string().min(1),
    templateKey: templateKeySchema,
    displayName: z.string().min(1),
    description: z.string().min(1),
    category: templateCategorySchema,
    supportedPageTypes: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).default(() => []),
    version: z.string().min(1),
    status: templateStatusSchema,
    featured: z.boolean().optional(),
    thumbnail: templateSkeletonAssetUrlSchema.optional(),
    owner: z.string().min(1).optional(),
    previewAssets: z.array(templateCatalogAssetSummarySchema).optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type TemplateCatalogEntry = z.infer<typeof templateCatalogEntrySchema>;

/** Filters and presentation hints for catalog listing. */
export const templateCatalogQuerySchema = z
  .object({
    category: templateCategorySchema.optional(),
    status: templateStatusSchema.optional(),
    pageType: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    query: z.string().optional(),
    featured: z.boolean().optional(),
    includeAssets: z.boolean().default(false),
    sort: templateCatalogSortSchema.default("displayName"),
  })
  .strict();

export type TemplateCatalogQuery = z.infer<typeof templateCatalogQuerySchema>;

export class TemplateCatalogValidationError extends Error {
  constructor(
    message: string,
    readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "TemplateCatalogValidationError";
  }
}

/** Parse and validate a catalog entry; throws {@link TemplateCatalogValidationError}. */
export function parseTemplateCatalogEntry(input: unknown): TemplateCatalogEntry {
  const result = templateCatalogEntrySchema.safeParse(input);
  if (!result.success) {
    throw new TemplateCatalogValidationError("Invalid template catalog entry", result.error.issues);
  }
  return result.data;
}

/** Parse catalog list query filters and defaults. */
export function parseTemplateCatalogQuery(input: unknown): TemplateCatalogQuery {
  const result = templateCatalogQuerySchema.safeParse(input ?? {});
  if (!result.success) {
    throw new TemplateCatalogValidationError("Invalid template catalog query", result.error.issues);
  }
  return result.data;
}

/** Parse a preview asset summary row. */
export function parseTemplateCatalogAssetSummary(input: unknown): TemplateCatalogAssetSummary {
  const result = templateCatalogAssetSummarySchema.safeParse(input);
  if (!result.success) {
    throw new TemplateCatalogValidationError(
      "Invalid template catalog asset summary",
      result.error.issues,
    );
  }
  return result.data;
}
