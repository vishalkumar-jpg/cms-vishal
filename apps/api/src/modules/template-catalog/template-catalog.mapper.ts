import {
  parseTemplateCatalogEntry,
  type TemplateCatalogAssetSummary,
  type TemplateCatalogEntry,
} from "@ob-cms/template-registry";
import type {
  TemplateSkeletonAssetRow,
  TemplateSkeletonRow,
} from "@database/schema/template-skeletons.schema";

/** Map a preview asset row to the lightweight catalog summary shape. */
export function toAssetSummary(row: TemplateSkeletonAssetRow): TemplateCatalogAssetSummary {
  return {
    id: row.id,
    assetType: row.assetType as TemplateCatalogAssetSummary["assetType"],
    url: row.url,
    mimeType: row.mimeType,
    altText: row.altText,
    sortOrder: row.sortOrder,
  };
}

/** Resolve catalog thumbnail from preview metadata or a thumbnail asset row. */
export function resolveThumbnailUrl(
  previewMetadata: TemplateSkeletonRow["previewMetadata"],
  assets?: TemplateSkeletonAssetRow[],
): string | undefined {
  if (previewMetadata.thumbnail) return previewMetadata.thumbnail;
  const thumbnailAsset = assets?.find((asset) => asset.assetType === "thumbnail");
  return thumbnailAsset?.url;
}

/**
 * Project skeleton metadata into a catalog entry.
 * Returns null when the row cannot satisfy catalog schema (e.g. empty page types).
 */
export function toCatalogEntry(
  meta: TemplateSkeletonRow,
  options?: {
    assets?: TemplateSkeletonAssetRow[];
    includePreviewAssets?: boolean;
  },
): TemplateCatalogEntry | null {
  if (meta.supportedPageTypes.length === 0) return null;

  const assets = options?.assets;
  const thumbnail = resolveThumbnailUrl(meta.previewMetadata, assets);

  const entry: TemplateCatalogEntry = {
    id: meta.id,
    templateKey: meta.templateKey,
    displayName: meta.displayName,
    description: meta.description,
    category: meta.category as TemplateCatalogEntry["category"],
    supportedPageTypes: meta.supportedPageTypes,
    tags: meta.tags,
    version: meta.version,
    status: meta.status as TemplateCatalogEntry["status"],
    createdAt: meta.createdAt.toISOString(),
    updatedAt: meta.updatedAt.toISOString(),
  };

  if (meta.previewMetadata.featured !== undefined) {
    entry.featured = meta.previewMetadata.featured;
  }
  if (thumbnail) {
    entry.thumbnail = thumbnail;
  }
  if (meta.previewMetadata.owner) {
    entry.owner = meta.previewMetadata.owner;
  }
  if (options?.includePreviewAssets && assets?.length) {
    entry.previewAssets = assets.map(toAssetSummary);
  }

  try {
    return parseTemplateCatalogEntry(entry);
  } catch {
    return null;
  }
}
