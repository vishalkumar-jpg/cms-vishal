import * as React from "react";
import { RepeaterItemContext, type RepeaterItem } from "@ob-cms/blocks";
import type { CollectionField, CollectionItem } from "@/views/collections/types";
import {
  CollectionDetailBuilderContextProvider,
  type CollectionDetailBuilderContextValue,
} from "../collection-detail/CollectionDetailBuilderContext";

/** Placeholder field data when no preview item is available yet. */
const SAMPLE_ITEM_DATA: Record<string, unknown> = {
  title: "Sample title",
  excerpt: "Sample excerpt text.",
};

const toRepeaterItem = (previewItem?: CollectionItem | null): RepeaterItem => ({
  data: previewItem?.data ?? SAMPLE_ITEM_DATA,
  index: 0,
  count: 1,
  id: previewItem?.id,
  slug: previewItem?.slug,
});

export interface PreviewCollectionItemProviderProps {
  collectionId: string;
  collectionSlug: string;
  fields: CollectionField[];
  previewItem?: CollectionItem | null;
  children: React.ReactNode;
}

/**
 * Collection Detail Builder preview runtime. Wraps the Craft canvas with:
 *  - `CollectionDetailBuilderContext` so property-panel binding controls expose
 *    the edited collection's fields at layout root (not only inside Repeaters).
 *  - `RepeaterItemContext` with a sample item so bound block props resolve on
 *    the canvas the same way `RenderLayout item={…}` does on the public site.
 *
 * Intended for the future Detail Builder route only — the page builder does not
 * mount this provider, so Repeater bindings there stay unchanged.
 */
export const PreviewCollectionItemProvider: React.FC<PreviewCollectionItemProviderProps> = ({
  collectionId,
  collectionSlug,
  fields,
  previewItem,
  children,
}) => {
  const detailContext = React.useMemo<CollectionDetailBuilderContextValue>(
    () => ({
      collectionId,
      collectionSlug,
      fields,
      previewItem,
    }),
    [collectionId, collectionSlug, fields, previewItem],
  );

  const repeaterItem = React.useMemo(() => toRepeaterItem(previewItem), [previewItem]);

  return (
    <CollectionDetailBuilderContextProvider value={detailContext}>
      <RepeaterItemContext.Provider value={repeaterItem}>{children}</RepeaterItemContext.Provider>
    </CollectionDetailBuilderContextProvider>
  );
};
