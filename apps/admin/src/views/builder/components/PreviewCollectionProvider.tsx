import * as React from "react";
import {
  CollectionRenderContext,
  type CollectionRenderContextValue,
  type CollectionItem as BlockCollectionItem,
} from "@ob-cms/blocks";
import {
  listCollectionsRequest,
  listItemsRequest,
} from "@/views/collections/api/collections.api";

/**
 * Builder-side collection runtime (preview mode). Provides the
 * `CollectionRenderContext` that Collection List blocks on the canvas read so
 * the chosen collection's items render in the editor — WYSIWYG with the
 * published site. `getItems` resolves the collection by SLUG (the prop the
 * builder stores) to its id, then lists its items via the admin axios
 * (site-scoped by the X-Site-Id header). The builder previews ALL items
 * (draft + published) so authors see content before publishing.
 */
export const PreviewCollectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = React.useMemo<CollectionRenderContextValue>(
    () => ({
      getItems: async (collectionSlug, opts) => {
        try {
          const collections = await listCollectionsRequest();
          const collection = collections.find((c) => c.slug === collectionSlug);
          if (!collection) return [];
          const page = await listItemsRequest(collection.id, {
            pageSize: opts?.limit ?? 12,
            sort: opts?.sort,
          });
          return page.items.map(
            (it): BlockCollectionItem => ({
              id: it.id,
              slug: it.slug,
              data: it.data,
              publishedAt: it.publishedAt,
            }),
          );
        } catch {
          return [];
        }
      },
    }),
    [],
  );

  return (
    <CollectionRenderContext.Provider value={value}>
      {children}
    </CollectionRenderContext.Provider>
  );
};
