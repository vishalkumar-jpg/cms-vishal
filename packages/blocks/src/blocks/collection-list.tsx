"use client";

import * as React from "react";
import { applyRootBlockStyles, useMounted, SafeLink } from "../lib";
import { sanitizeText, sanitizeUrl } from "@ob-cms/block-schema";
import { CollectionRenderContext, type CollectionItem } from "../collection-context";

/**
 * Collection List — a DATA-RESOLVING block (HubDB / WP-CPT list), mirroring the
 * Form and Reusable blocks. It reads `CollectionRenderContext` to fetch the
 * published items of a collection (by slug) and renders a responsive grid of
 * cards. `cardFields` selects which field keys map to the card's image / title /
 * excerpt; `linkPattern` builds each card's href (`:slug` is substituted).
 *
 * Environment-agnostic:
 *  - Renderer provides a live context (same-origin proxy → host-resolved API).
 *  - Builder provides a preview context (admin axios).
 *  - No context (raw SSR) → a static placeholder.
 *
 * SSR-safe: the server output is a stable placeholder; items resolve only after
 * mount (`useMounted`), so there is no `window` access at module load and no
 * hydration mismatch.
 */
interface CollectionListProps {
  collectionSlug?: string;
  limit?: number;
  columns?: number;
  sort?: string;
  /** Field keys: [imageKey?, titleKey?, excerptKey?]. */
  cardFields?: string[];
  /** href template, e.g. "/c/case-studies/:slug". `:slug` → the item slug. */
  linkPattern?: string;
  styles?: unknown;
}

const Placeholder: React.FC<{ label: string; tone?: "muted" | "loading" }> = ({
  label,
  tone = "muted",
}) => (
  <div
    style={{
      border: "1px dashed #cbd5e1",
      borderRadius: "0.5rem",
      padding: "1.5rem",
      textAlign: "center",
      color: tone === "loading" ? "#94a3b8" : "#64748b",
    }}
  >
    {label}
  </div>
);

const pickString = (item: CollectionItem, key?: string): string | undefined => {
  if (!key) return undefined;
  const v = item.data[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
};

/** When no explicit title field is configured, fall back to a sensible one
 *  (title/name/heading) or the first non-empty string field — only then the
 *  slug — so cards never show a raw slug by default. */
const autoTitle = (item: CollectionItem): string => {
  for (const k of ["title", "name", "heading", "label"]) {
    const v = pickString(item, k);
    if (v) return v;
  }
  for (const v of Object.values(item.data)) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return item.slug;
};

const buildHref = (linkPattern: string | undefined, slug: string): string | undefined => {
  if (!linkPattern) return undefined;
  return linkPattern.replace(/:slug\b/g, slug);
};

export const CollectionList = React.forwardRef<HTMLDivElement, CollectionListProps>(
  (
    { collectionSlug, limit = 9, columns = 3, sort, cardFields, linkPattern, styles },
    ref,
  ) => {
    const ctx = React.useContext(CollectionRenderContext);
    const mounted = useMounted();
    const [items, setItems] = React.useState<CollectionItem[] | null>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
      if (!mounted || !ctx || !collectionSlug) return;
      let cancelled = false;
      setLoading(true);
      ctx
        .getItems(collectionSlug, { limit, sort })
        .then((resolved) => {
          if (!cancelled) setItems(resolved);
        })
        .catch(() => {
          if (!cancelled) setItems(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [mounted, ctx, collectionSlug, limit, sort]);

    const rootStyle: React.CSSProperties = applyRootBlockStyles(styles, {
      structural: { display: "block", boxSizing: "border-box" },
    });

    if (!collectionSlug) {
      return (
        <div ref={ref} style={rootStyle}>
          <Placeholder label="Select a collection" />
        </div>
      );
    }

    if (!mounted || !ctx || loading || !items) {
      return (
        <div ref={ref} style={rootStyle}>
          <Placeholder
            label={!mounted || loading ? "Loading collection…" : "Collection unavailable"}
            tone="loading"
          />
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

    const cols = Math.min(6, Math.max(1, Number(columns) || 3));
    const [imageKey, titleKey, excerptKey] = cardFields ?? [];

    const gridStyle: React.CSSProperties = {
      display: "grid",
      gap: "1.5rem",
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    };

    return (
      <div ref={ref} style={rootStyle}>
        <div style={gridStyle} className="ob-collection-list">
          {items.map((item) => {
            const img = sanitizeUrl(pickString(item, imageKey));
            const title = pickString(item, titleKey) ?? autoTitle(item);
            const excerpt = pickString(item, excerptKey);
            const href = buildHref(linkPattern, item.slug);

            const card = (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  borderRadius: "0.75rem",
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  height: "100%",
                }}
              >
                {img ? (
                  <img
                    src={img}
                    loading="lazy"
                    alt={sanitizeText(title)}
                    style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }}
                  />
                ) : null}
                <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "#0f172a" }}>
                    {sanitizeText(title)}
                  </h3>
                  {excerpt ? (
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "#475569", lineHeight: 1.5 }}>
                      {sanitizeText(excerpt)}
                    </p>
                  ) : null}
                </div>
              </div>
            );

            return (
              <div key={item.id} style={{ display: "block" }}>
                {href ? (
                  <SafeLink url={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
                    {card}
                  </SafeLink>
                ) : (
                  card
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
CollectionList.displayName = "Collection List";
