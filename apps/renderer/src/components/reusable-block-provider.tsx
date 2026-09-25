"use client";

import * as React from "react";
import type {
  ComponentProp,
  ComponentVariant,
  ResolvedComponent,
  SerializedLayout,
} from "@ob-cms/block-schema";
import {
  ReusableBlockContext,
  fetchReusableBlockCached,
  type ReusableBlockRenderContextValue,
} from "@ob-cms/blocks";

/** The shape of the same-origin proxy's `data` payload (REUSE-BLOCKS / COMPONENTS). */
type ResolvePayload = {
  layout?: SerializedLayout;
  props?: ComponentProp[];
  variants?: ComponentVariant[];
};

/**
 * Live reusable-block runtime for the published site (REUSE-BLOCKS / COMPONENTS).
 */
export const LiveReusableBlockProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = React.useMemo<ReusableBlockRenderContextValue>(() => {
    const load = async (
      id: string,
    ): Promise<{ layout: SerializedLayout | null; component: ResolvedComponent | null }> =>
      fetchReusableBlockCached(id, async () => {
        try {
          const res = await fetch(`/api/reusable-blocks/${encodeURIComponent(id)}`, {
            headers: { accept: "application/json" },
          });
          if (!res.ok) return { layout: null, component: null };
          const json = (await res.json()) as { data?: ResolvePayload };
          const data = json.data ?? null;
          if (!data?.layout) return { layout: null, component: null };
          const component: ResolvedComponent = {
            layout: data.layout,
            props: data.props ?? [],
            variants: data.variants ?? [],
          };
          return { layout: data.layout, component };
        } catch {
          return { layout: null, component: null };
        }
      });

    return {
      getReusable: async (id) => (await load(id)).layout,
      getComponent: async (id) => (await load(id)).component,
    };
  }, []);

  return (
    <ReusableBlockContext.Provider value={value}>
      {children}
    </ReusableBlockContext.Provider>
  );
};
