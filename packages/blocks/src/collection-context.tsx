"use client";

import * as React from "react";

/** A resolved published collection item (data keyed by the collection's field keys). */
export interface CollectionItem {
  id: string;
  slug: string;
  data: Record<string, unknown>;
  publishedAt?: string | null;
}

export interface CollectionGetItemsOpts {
  limit?: number;
  sort?: string;
}

/**
 * Data-resolving context for the `Collection List` block, mirroring
 * FormRenderContext / ReusableBlockContext. The RENDERER provides a live
 * implementation (same-origin proxy → host-resolved public API); the ADMIN
 * provides a preview implementation (admin axios → site-scoped API). When no
 * provider is present (raw SSR), the block falls back to a static placeholder.
 */
export interface CollectionRenderContextValue {
  getItems: (
    collectionSlug: string,
    opts?: CollectionGetItemsOpts,
  ) => Promise<CollectionItem[]>;
}

export const CollectionRenderContext =
  React.createContext<CollectionRenderContextValue | null>(null);

export const useCollectionRenderContext = (): CollectionRenderContextValue | null =>
  React.useContext(CollectionRenderContext);
