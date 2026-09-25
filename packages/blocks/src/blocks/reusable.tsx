"use client";

import * as React from "react";
import {
  migrate,
  resolveComponentInstance,
  layoutHasContent,
  unwrapPassthroughFragment,
  isIntrinsicWidthFragmentRoot,
  type ComponentInstanceConfig,
  type ResolvedComponent,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { applyRootBlockStyles, cx, useMounted } from "../lib";
import { BlockEditingContext } from "../editable-text";
import { renderNode } from "../render-layout";
import { blockComponents } from "../block-components";
import { ReusableBlockContext } from "../reusable-context";
import { subscribeReusableBlockCache } from "../reusable-fetch-cache";

/**
 * Reusable / global synced block (REUSE-BLOCKS). A REFERENCE to a stored
 * `reusable_blocks` row (chosen via `reusableBlockId` in the builder). It reads
 * `ReusableBlockContext` to resolve that row's SerializedLayout, then renders it
 * with the shared block registry. Editing the source row updates EVERY instance
 * ("edit once, update everywhere") — distinct from one-time template copies.
 *
 * Environment-agnostic, mirroring the Form block:
 *  - Renderer provides a live context (same-origin proxy → host-resolved API).
 *  - Builder provides a preview context (admin axios).
 *  - No context (raw SSR) → a static placeholder.
 *
 * SSR-safe: the server output is a stable placeholder; the referenced layout is
 * resolved only after mount (`useMounted`), so there is no `window` access at
 * module load and no hydration mismatch.
 */
interface ReusableBlockProps {
  reusableBlockId?: string;
  /** COMPONENTS: per-instance overrides (all optional → plain reference still works). */
  variant?: string;
  propOverrides?: Record<string, unknown>;
  slotContent?: Record<string, SerializedLayout>;
  styles?: unknown;
}

const BUILDER_PREVIEW_CTX = {
  editing: false,
  commit: () => {},
};

const Placeholder: React.FC<{
  label: string;
  tone?: "muted" | "loading" | "warning";
  actionLabel?: string;
  onAction?: () => void;
}> = ({ label, tone = "muted", actionLabel, onAction }) => (
  <div
    style={{
      border: `1px dashed ${tone === "warning" ? "#f59e0b" : "#cbd5e1"}`,
      borderRadius: "0.5rem",
      padding: "1.25rem 1rem",
      textAlign: "center",
      color: tone === "loading" ? "#94a3b8" : tone === "warning" ? "#b45309" : "#64748b",
      background: tone === "warning" ? "#fffbeb" : undefined,
      fontSize: "0.875rem",
      lineHeight: 1.45,
    }}
  >
    <p style={{ margin: 0 }}>{label}</p>
    {actionLabel && onAction ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        style={{
          marginTop: "0.75rem",
          padding: "6px 14px",
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "#fff",
          background: "#147eff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

export const ReusableBlock = React.forwardRef<HTMLDivElement, ReusableBlockProps>(
  ({ reusableBlockId, variant, propOverrides, slotContent, styles }, ref) => {
    const ctx = React.useContext(ReusableBlockContext);
    const mounted = useMounted();
    const [component, setComponent] = React.useState<ResolvedComponent | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [cacheVersion, setCacheVersion] = React.useState(0);

    React.useEffect(
      () =>
        subscribeReusableBlockCache((id) => {
          if (!id || id === reusableBlockId) setCacheVersion((v) => v + 1);
        }),
      [reusableBlockId],
    );

    React.useEffect(() => {
      if (!mounted || !ctx || !reusableBlockId) return;
      let cancelled = false;
      setLoading(true);
      const fetchDef = ctx.getComponent
        ? ctx.getComponent(reusableBlockId)
        : ctx.getReusable(reusableBlockId).then((layout) =>
            layout ? ({ layout } as ResolvedComponent) : null,
          );
      fetchDef
        .then((resolved) => {
          if (!cancelled) setComponent(resolved);
        })
        .catch(() => {
          if (!cancelled) setComponent(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [mounted, ctx, reusableBlockId, cacheVersion]);

    const isAdminBuilder = Boolean(ctx?.editReusableBlock);
    const inEditorCanvas = Boolean(ctx?.editorCanvas);

    const buildRootStyle = (layout?: SerializedLayout | null): React.CSSProperties => {
      const intrinsic = layout ? isIntrinsicWidthFragmentRoot(layout) : false;
      return applyRootBlockStyles(styles, {
        structural: {
          display: "block",
          boxSizing: "border-box",
          width: intrinsic ? "fit-content" : "100%",
          maxWidth: "100%",
          minHeight: isAdminBuilder && !intrinsic ? 72 : undefined,
          position: "relative",
        },
      });
    };

    if (!reusableBlockId) {
      return (
        <div ref={ref} className="cms-reusable-block" style={buildRootStyle()}>
          <Placeholder label="Select a reusable block" />
        </div>
      );
    }

    if (!mounted) {
      return (
        <div ref={ref} className="cms-reusable-block" style={buildRootStyle()}>
          <Placeholder label="Loading reusable block…" tone="loading" />
        </div>
      );
    }

    if (!ctx) {
      return (
        <div ref={ref} className="cms-reusable-block" style={buildRootStyle()}>
          <Placeholder
            label="Reusable block preview is unavailable in this view."
            tone="warning"
          />
        </div>
      );
    }

    if (loading) {
      return (
        <div ref={ref} className="cms-reusable-block" style={buildRootStyle()}>
          <Placeholder label="Loading reusable block…" tone="loading" />
        </div>
      );
    }

    if (!component) {
      return (
        <div ref={ref} className="cms-reusable-block" style={buildRootStyle()}>
          <Placeholder
            label="Could not load this reusable block. Check that it still exists for this site."
            tone="warning"
          />
        </div>
      );
    }

    const config: ComponentInstanceConfig = { variant, propOverrides, slotContent };
    const resolved = resolveComponentInstance(
      { ...component, layout: migrate(component.layout) },
      config,
    );
    const layout = unwrapPassthroughFragment(migrate(resolved));
    const blockName = component.name;
    const hasContent = layoutHasContent(layout);
    const intrinsic = isIntrinsicWidthFragmentRoot(layout);
    const rootStyle = buildRootStyle(layout);

    const previewBody = hasContent ? (
      <BlockEditingContext.Provider value={BUILDER_PREVIEW_CTX}>
        {renderNode(layout.root, layout, blockComponents, {
          env: inEditorCanvas ? { editor: true } : {},
          item: null,
        })}
      </BlockEditingContext.Provider>
    ) : (
      <Placeholder
        label={
          blockName
            ? `“${blockName}” has no content yet. Add sections in the reusable editor, then save.`
            : "This reusable block has no content yet. Edit its source in Reusable Blocks."
        }
        tone="warning"
        actionLabel={
          isAdminBuilder && reusableBlockId && ctx?.editReusableBlock
            ? `Edit “${blockName ?? "block"}”`
            : undefined
        }
        onAction={
          isAdminBuilder && reusableBlockId && ctx?.editReusableBlock
            ? () => ctx.editReusableBlock!(reusableBlockId)
            : undefined
        }
      />
    );

    return (
      <div
        ref={ref}
        className={cx("cms-reusable-block", intrinsic && "cms-reusable-block--intrinsic")}
        {...(intrinsic ? { "data-ob-intrinsic": "true" } : {})}
        style={rootStyle}
      >
        {previewBody}
      </div>
    );
  },
);
ReusableBlock.displayName = "ReusableBlock";
