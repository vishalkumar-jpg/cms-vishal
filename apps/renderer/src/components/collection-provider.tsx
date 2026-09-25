"use client";

import * as React from "react";
import {
  CollectionRenderContext,
  type CollectionRenderContextValue,
  type CollectionItem,
} from "@ob-cms/blocks";

/**
 * Live collection runtime for the published site. Provides the
 * `CollectionRenderContext` that Collection List blocks read:
 *  - `getItems` → `GET /api/collections/:slug/items` (same-origin → proxied to
 *    the host-resolved public API, which keeps the tenant Host correct).
 *
 * Same-origin is required because the public API resolves the tenant from the
 * Host header and the browser can only send the renderer's own host; the proxy
 * route forwards it. Client-only ("use client"); the value is stable.
 */
export const LiveCollectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = React.useMemo<CollectionRenderContextValue>(
    () => ({
      getItems: async (collectionSlug, opts) => {
        try {
          const qs = new URLSearchParams();
          if (opts?.limit) qs.set("limit", String(opts.limit));
          if (opts?.sort) qs.set("sort", opts.sort);
          const suffix = qs.toString() ? `?${qs.toString()}` : "";
          const res = await fetch(
            `/api/collections/${encodeURIComponent(collectionSlug)}/items${suffix}`,
            { headers: { accept: "application/json" } },
          );
          if (!res.ok) return [];
          const json = (await res.json()) as { data?: { items?: CollectionItem[] } };
          return json.data?.items ?? [];
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
