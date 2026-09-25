"use client";

import * as React from "react";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { applyRootBlockStyles, useMounted } from "../lib";
import { CollectionRenderContext, type CollectionItem } from "../collection-context";
import { RepeaterItemContext, type RepeaterItem } from "../repeater-context";
import { renderSubtree } from "../render-layout";
import { blockRegistry } from "../registry";
import type { RenderEnv } from "../render-context";

/**
 * Repeater — a DYNAMIC, canvas block that loops its single template subtree over
 * a collection. It mirrors Collection List's data plumbing (reads
 * `CollectionRenderContext.getItems(collectionSlug, …)`) but, instead of a fixed
 * card grid, it repeats the AUTHORED template once per item with that item's
 * `data` exposed via `RepeaterItemContext` so descendant block props can bind to
 * collection fields.
 *
 * Two render modes — same component, editor↔renderer parity:
 *  - RENDERER: `renderNode` injects the (serializable) node map + template child
 *    ids + env (`__data`/`__templateIds`/`__env`). The Repeater
 *    re-enters the SHARED walker (`renderSubtree`) once PER published item, each
 *    wrapped in its `RepeaterItemContext`. The injected props are plain data, so
 *    they cross the RSC→client boundary cleanly.
 *  - EDITOR: no injected node map → the Repeater renders its Craft `children`
 *    ONCE (the authoring instance) wrapped in a SAMPLE item (the first resolved
 *    item, else placeholder data) so the user edits ONE template, plus a small
 *    "repeats × N" affordance.
 *
 * SSR-safe: items resolve only after mount (`useMounted`), matching Collection
 * List, so server output is a stable placeholder and there's no hydration
 * mismatch. Blocks without a Repeater ancestor are entirely unaffected.
 */
interface RepeaterProps {
  collectionSlug?: string;
  limit?: number;
  sort?: string;
  filter?: string;
  styles?: unknown;
  /** Injected by the renderer's `renderNode` (all serializable plain JSON). */
  __data?: SerializedLayout;
  __templateIds?: string[];
  __env?: RenderEnv;
  /** Craft passes the authored template children here (editor only). */
  children?: React.ReactNode;
}

const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      border: "1px dashed #cbd5e1",
      borderRadius: "0.5rem",
      padding: "1.5rem",
      textAlign: "center",
      color: "#64748b",
    }}
  >
    {label}
  </div>
);

/** A synthetic sample item so the editor template renders with believable data
 *  even before items load (or when none exist yet). */
const sampleItem = (item?: CollectionItem | null): RepeaterItem => ({
  data: item?.data ?? { title: "Sample title", excerpt: "Sample excerpt text." },
  index: 0,
  count: 1,
  id: item?.id,
  slug: item?.slug,
});

export const Repeater = React.forwardRef<HTMLDivElement, RepeaterProps>(
  ({ collectionSlug, limit = 12, sort, styles, __data, __templateIds, __env, children }, ref) => {
    const ctx = React.useContext(CollectionRenderContext);
    const mounted = useMounted();
    const [items, setItems] = React.useState<CollectionItem[] | null>(null);

    // The renderer injects a node map → this is the published render path.
    const isRenderer = !!__data;

    React.useEffect(() => {
      if (!mounted || !ctx || !collectionSlug) return;
      let cancelled = false;
      ctx
        .getItems(collectionSlug, { limit, sort })
        .then((resolved) => {
          if (!cancelled) setItems(resolved);
        })
        .catch(() => {
          if (!cancelled) setItems(null);
        });
      return () => {
        cancelled = true;
      };
    }, [mounted, ctx, collectionSlug, limit, sort]);

    const rootStyle: React.CSSProperties = applyRootBlockStyles(styles, {
      structural: { display: "block", boxSizing: "border-box" },
    });

    // ── EDITOR MODE ──────────────────────────────────────────────────────────
    if (!isRenderer) {
      const count = items?.length ?? 0;
      return (
        <div ref={ref} style={rootStyle}>
          {collectionSlug ? (
            <div
              style={{
                display: "inline-block",
                marginBottom: 8,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: "#eef2ff",
                color: "#4338ca",
              }}
            >
              {`Repeats × ${count || "?"}`}
            </div>
          ) : (
            <Placeholder label="Repeater — select a collection in the panel" />
          )}
          <RepeaterItemContext.Provider value={sampleItem(items?.[0])}>
            {children}
          </RepeaterItemContext.Provider>
        </div>
      );
    }

    // ── RENDERER MODE ────────────────────────────────────────────────────────
    if (!collectionSlug) {
      return (
        <div ref={ref} style={rootStyle}>
          <Placeholder label="Select a collection" />
        </div>
      );
    }
    if (!mounted || !ctx || items === null) {
      return (
        <div ref={ref} style={rootStyle}>
          <Placeholder label="Loading…" />
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div ref={ref} style={rootStyle}>
          <Placeholder label="No items yet" />
        </div>
      );
    }

    const templateIds = __templateIds ?? [];
    const env = __env ?? {};
    return (
      <div ref={ref} style={rootStyle}>
        {items.map((item, index) => (
          <RepeaterItemContext.Provider
            key={item.id}
            value={{ data: item.data, index, count: items.length, id: item.id, slug: item.slug }}
          >
            {renderSubtree(templateIds, __data as SerializedLayout, blockRegistry, {
              env,
              item: item.data,
            })}
          </RepeaterItemContext.Provider>
        ))}
      </div>
    );
  },
);
Repeater.displayName = "Repeater";
