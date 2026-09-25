import type { CollectionField } from "@/views/collections/types";
import type { CollectionDetailBuilderContextValue } from "../collection-detail/CollectionDetailBuilderContext";

/**
 * Pure resolver for which collection fields a node may bind to. The hook layer
 * supplies the active detail-builder context (if any), the nearest ancestor
 * Repeater's collection slug, and the site's collections list.
 */
export function resolveBindableFields(
  detailContext: CollectionDetailBuilderContextValue | null,
  repeaterSlug: string | null,
  collections: Array<{ slug: string; fields: CollectionField[] }>,
): CollectionField[] {
  if (detailContext) {
    return detailContext.fields;
  }
  if (!repeaterSlug) return [];
  return collections.find((c) => c.slug === repeaterSlug)?.fields ?? [];
}
