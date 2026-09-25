"use client";

import * as React from "react";
import { applyRootBlockStyles, cx, useMounted, resolveSurfaceStyles, authoredSpacingAttr, shouldStackRowOnNarrow, withAuthorLayout, authoredLayoutAttr, hasExplicitResponsiveLayoutProp, keepRowOnNarrowViewport, rowHasColumnChildren } from "../lib";
import { MobileCarouselParentProvider, useInMobileCarousel } from "../mobile-carousel-context";
import { isNarrowViewport, useOBViewport } from "../viewport-context";
import { RowLayoutContext, useRowLayout } from "../row-layout-context";
import { BlockEditingContext } from "../editable-text";

/**
 * Canvas / layout primitives — pure, SSR-safe. Each consumes a `styles`
 * StyleModel (resolved to CSS) and renders its children (the node tree walked
 * by RenderLayout). No browser APIs at module load.
 *
 * Every block forwards a `ref` onto its single outermost root DOM element so
 * the Craft.js builder can attach drag/select connectors to the real node.
 */

interface CanvasProps {
  styles?: unknown;
  className?: string;
  children?: React.ReactNode;
}

const CARD_DEFAULTS: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  padding: 24,
};

export const Section = React.forwardRef<HTMLElement, CanvasProps & { sectionId?: string; tag?: string }>(
  ({ children, styles, tag = "section", sectionId, className }, ref) => {
    const Tag = tag as React.ElementType;
    const inBuilder = React.useContext(BlockEditingContext) != null;
    const sectionStyle = applyRootBlockStyles(styles, {
      structural: { width: "100%", position: "relative", boxSizing: "border-box" },
    });
    const pinTopbar =
      !inBuilder &&
      typeof className === "string" &&
      className.includes("ob-site-topbar") &&
      className.includes("ob-site-topbar--sticky");
    return (
      <Tag
        ref={ref}
        id={sectionId || undefined}
        className={cx("cms-section", className)}
        {...(pinTopbar ? { "data-ob-sticky-topbar": "" as const } : {})}
        style={
          pinTopbar
            ? { ...sectionStyle, position: "sticky", top: 0, zIndex: 501 }
            : sectionStyle
        }
        {...authoredSpacingAttr(styles)}
      >
        {children}
      </Tag>
    );
  },
);
Section.displayName = "Section";

export const Container = React.forwardRef<HTMLDivElement, CanvasProps & { maxWidth?: number | string }>(
  ({ children, styles, maxWidth, className }, ref) => {
    const resolved = applyRootBlockStyles(styles, {
      structural: { margin: "0 auto", width: "100%", position: "relative", boxSizing: "border-box" },
    });
    const resolvedMax = maxWidth ?? (resolved.maxWidth as string | number | undefined) ?? 1200;
    return (
      <div
        ref={ref}
        className={cx("cms-container", className)}
        style={{ ...resolved, maxWidth: resolvedMax }}
        {...authoredSpacingAttr(styles)}
      >
        {children}
      </div>
    );
  },
);
Container.displayName = "Container";

const isStandardFlexRow = (resolved: React.CSSProperties): boolean => {
  const display = String(resolved.display ?? "flex");
  const dir = String(resolved.flexDirection ?? "row");
  return display === "flex" && (dir === "row" || dir === "" || dir === "row-reverse");
};

export const Row = React.forwardRef<HTMLDivElement, CanvasProps>(
  ({ children, styles, className }, ref) => {
    const viewport = useOBViewport();
    const narrow = isNarrowViewport(viewport);
    let resolved = applyRootBlockStyles(styles, {
      structural: { width: "100%", boxSizing: "border-box", display: "flex", flexWrap: "wrap" },
    });
    const keepHorizontal = keepRowOnNarrowViewport(className, resolved);
    const hasColumns = rowHasColumnChildren(children);
    const stackOnNarrow =
      narrow && !keepHorizontal && hasColumns && shouldStackRowOnNarrow(styles, resolved);
    if (viewport != null && stackOnNarrow) {
      resolved.flexDirection = "column";
      resolved.justifyContent = "flex-start";
      resolved.alignItems = "stretch";
    } else if (
      viewport == null &&
      !keepHorizontal &&
      hasColumns &&
      isStandardFlexRow(resolved) &&
      shouldStackRowOnNarrow(styles, resolved)
    ) {
      // Published pages: defer row stacking to container-query CSS (inline flexDirection
      // would block mobile rules that use !important).
      delete resolved.flexDirection;
    }
    resolved = withAuthorLayout(resolved);
    const layoutAttrs = {
      ...authoredLayoutAttr(styles, resolved),
      ...(keepHorizontal ? { "data-ob-keep-row": "" as const } : {}),
    };
    const rowMode: "row" | "column" =
      narrow && (keepHorizontal || layoutAttrs["data-ob-keep-row"] != null || !stackOnNarrow)
        ? "row"
        : "column";
    return (
      <RowLayoutContext.Provider value={rowMode}>
        <div
          ref={ref}
          className={cx("cms-auto-row", className)}
          style={resolved}
          {...authoredSpacingAttr(styles)}
          {...layoutAttrs}
        >
          {children}
        </div>
      </RowLayoutContext.Provider>
    );
  },
);
Row.displayName = "Row";

export const Column = React.forwardRef<HTMLDivElement, CanvasProps & { flex?: number | string }>(
  ({ children, styles, flex, className }, ref) => {
    const viewport = useOBViewport();
    const narrow = isNarrowViewport(viewport);
    const inMobileCarousel = useInMobileCarousel();
    const rowLayout = useRowLayout();
    const resolved = applyRootBlockStyles(styles, {
      structural: { flex: flex ?? 1, minWidth: 0, maxWidth: "100%", boxSizing: "border-box" },
    });
    if (narrow && !inMobileCarousel && rowLayout !== "row") {
      resolved.flex = "1 1 100%";
      resolved.width = "100%";
      resolved.maxWidth = "100%";
    }
    return (
      <div ref={ref} data-cms-col className={cx("cms-auto-col", className)} style={resolved} {...authoredSpacingAttr(styles)}>
        {children}
      </div>
    );
  },
);
Column.displayName = "Column";

export const Grid = React.forwardRef<HTMLDivElement, CanvasProps & { columns?: number }>(
  ({ children, styles, columns = 3, className }, ref) => {
    const viewport = useOBViewport();
    const narrow = isNarrowViewport(viewport);
    const cols = Math.max(1, Math.min(Number(columns) || 3, 6));
    const colClass = cols >= 2 && cols <= 5 ? `ob-grid-cols-${cols}` : undefined;
    const resolved = applyRootBlockStyles(styles, { structural: { width: "100%", boxSizing: "border-box" } });
    const userGridCols = resolved.gridTemplateColumns as string | undefined;
    const standardGrid = `repeat(${cols}, minmax(0, 1fr))`;
    const isStandardGrid =
      !userGridCols ||
      userGridCols === standardGrid ||
      userGridCols === `repeat(${cols}, 1fr)`;
    const style: React.CSSProperties = { ...resolved, display: "grid" };
    const optOutCarousel =
      typeof className === "string" &&
      (className.includes("ob-stats-grid") ||
        className.includes("ob-steps-grid") ||
        className.includes("ob-no-mobile-carousel"));
    const optOutAutoLoop =
      typeof className === "string" && className.includes("ob-no-auto-loop");
    const mobileCarousel = cols > 1 && !optOutCarousel;
    const autoLoop = mobileCarousel && !optOutAutoLoop;
    if (viewport != null) {
      if (narrow && !hasExplicitResponsiveLayoutProp(styles, "gridTemplateColumns")) {
        style.gridTemplateColumns = "1fr";
      } else if (userGridCols) {
        style.gridTemplateColumns = userGridCols;
      } else {
        style.gridTemplateColumns = standardGrid;
      }
    } else if (!isStandardGrid && userGridCols) {
      style.gridTemplateColumns = userGridCols;
    } else {
      delete style.gridTemplateColumns;
    }
    return (
      <MobileCarouselParentProvider value={mobileCarousel}>
        <div
          ref={ref}
          data-columns={String(cols)}
          {...(mobileCarousel ? { "data-mobile-carousel": "true" } : {})}
          {...(autoLoop ? { "data-auto-loop": "true" } : {})}
          className={cx("cms-auto-grid", colClass, className)}
          style={style}
        >
          {children}
        </div>
      </MobileCarouselParentProvider>
    );
  },
);
Grid.displayName = "Grid";

/**
 * Slider — a horizontal, swipeable track whose CHILDREN are the slides (each
 * direct child node becomes one slide). A true canvas block: drop any blocks
 * (Video, cards, images…) inside and they become editable slides. SSR-safe —
 * the track is a native horizontal scroller (works without JS); after mount the
 * prev/next arrows scroll it smoothly. `slidesVisible` sizes each slide via CSS
 * custom properties so arbitrary child nodes are laid out evenly.
 */
export const Slider = React.forwardRef<
  HTMLDivElement,
  CanvasProps & {
    slidesVisible?: number;
    gap?: number;
    showArrows?: boolean;
    autoplay?: boolean;
    autoplayInterval?: number;
  }
>(({ children, styles, slidesVisible = 3, gap = 24, showArrows = true, autoplay = true, autoplayInterval = 5000, className }, ref) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const viewport = useOBViewport();
  const narrow = isNarrowViewport(viewport);
  const mobile = viewport === "mobile";
  const effectiveSlides = narrow ? 1 : slidesVisible;
  const scrollByDir = (dir: number): void => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.8 * dir, behavior: "smooth" });
  };
  const trackStyle = {
    display: "flex",
    gap,
    scrollBehavior: "smooth",
    ["--ob-slides"]: String(viewport != null ? effectiveSlides : slidesVisible),
    ["--ob-gap"]: `${gap}px`,
    ...(viewport != null
      ? {
          overflowX: "auto",
          flexDirection: "row",
          flexWrap: "nowrap",
          scrollSnapType: "x mandatory",
        }
      : {}),
  } as React.CSSProperties;
  const { wrapper, surface: arrowSurface } = resolveSurfaceStyles(styles, {
    cursor: "pointer",
    font: "inherit",
    fontWeight: 600,
  });
  return (
    <div
      ref={ref}
      className={cx("ob-slider", narrow && "ob-slider--one-slide", className)}
      {...(autoplay ? { "data-auto-loop": "true" } : {})}
      {...(autoplay ? { "data-autoplay-interval": String(autoplayInterval) } : {})}
      style={{ width: "100%", position: "relative", boxSizing: "border-box", ...wrapper }}
    >
      <div ref={trackRef} className="ob-slider__track" style={trackStyle}>
        {children}
      </div>
      {mounted && showArrows && !mobile ? (
        <div className="ob-slider__nav">
          <button
            type="button"
            className="ob-carousel-btn ob-btn"
            style={arrowSurface}
            onClick={() => scrollByDir(-1)}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            className="ob-carousel-btn ob-btn"
            style={arrowSurface}
            onClick={() => scrollByDir(1)}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
});
Slider.displayName = "Slider";

export const Div = React.forwardRef<HTMLElement, CanvasProps & { tag?: string }>(
  ({ children, styles, tag = "div", className }, ref) => {
    const viewport = useOBViewport();
    const narrow = isNarrowViewport(viewport);
    const Tag = tag as React.ElementType;
    const resolved = applyRootBlockStyles(styles, {
      structural: { position: "relative", boxSizing: "border-box" },
    });
    const modelLayout = ((styles as { layout?: Record<string, unknown> })?.layout ?? {}) as Record<
      string,
      unknown
    >;
    const wantsFlex =
      modelLayout.display === "flex" ||
      modelLayout.flexDirection != null ||
      modelLayout.justifyContent != null ||
      modelLayout.alignItems != null ||
      modelLayout.gap != null;
    if (wantsFlex && !resolved.display) {
      resolved.display = "flex";
    }
    const keepHorizontal = keepRowOnNarrowViewport(className, resolved);
    const display = String(resolved.display ?? "");
    const dir = String(resolved.flexDirection ?? "row");
    const isFlexRow =
      display === "flex" && (dir === "row" || dir === "row-reverse" || dir === "");
    const stackOnNarrow =
      narrow && !keepHorizontal && shouldStackRowOnNarrow(styles, resolved) && isFlexRow;
    if (stackOnNarrow) {
      resolved.flexDirection = "column";
      resolved.alignItems = resolved.alignItems ?? "stretch";
    }
    if (
      narrow &&
      display === "grid" &&
      resolved.gridTemplateColumns &&
      resolved.gridTemplateColumns !== "1fr" &&
      !hasExplicitResponsiveLayoutProp(styles, "gridTemplateColumns")
    ) {
      resolved.gridTemplateColumns = "1fr";
    }
    const layoutAttrs = {
      ...authoredLayoutAttr(styles, resolved),
      ...(keepHorizontal ? { "data-ob-keep-row": "" as const } : {}),
    };
    return (
      <Tag
        ref={ref}
        className={cx("cms-div", className)}
        {...(isFlexRow ? { "data-ob-flex-row": "true" } : {})}
        style={withAuthorLayout(resolved)}
        {...layoutAttrs}
        {...authoredSpacingAttr(styles)}
      >
        {children}
      </Tag>
    );
  },
);
Div.displayName = "Div";

/**
 * Spacer — a pure vertical gap. Non-canvas (holds no children); the only knob is
 * its height. Lets non-technical users add breathing room without touching
 * padding/margin fields.
 */
export const Spacer = React.forwardRef<HTMLDivElement, { height?: number; styles?: unknown }>(
  ({ height = 40, styles }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className="cms-spacer"
      style={applyRootBlockStyles(styles, {
        structural: { width: "100%", height, flex: "none" },
      })}
    />
  ),
);
Spacer.displayName = "Spacer";

/**
 * Card — a padded, rounded, bordered surface (a canvas). Drop anything inside;
 * it gives instant "card" styling (shadow + radius) without manual borders.
 */
export const Card = React.forwardRef<HTMLDivElement, CanvasProps>(
  ({ children, styles, className }, ref) => (
    <div
      ref={ref}
      className={cx("cms-card", className)}
      style={applyRootBlockStyles(styles, {
        structural: { position: "relative", boxSizing: "border-box" },
        defaults: CARD_DEFAULTS,
      })}
    >
      {children}
    </div>
  ),
);
Card.displayName = "Card";

/**
 * Group — a flexible wrapper (a canvas) that lays its children in a row by
 * default. A friendlier alias for "put these together and align them" without
 * exposing raw flex controls first.
 */
export const Group = React.forwardRef<HTMLDivElement, CanvasProps>(
  ({ children, styles, className }, ref) => {
    const viewport = useOBViewport();
    const narrow = isNarrowViewport(viewport);
    const resolved = applyRootBlockStyles(styles, {
      structural: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        boxSizing: "border-box",
      },
    });
    const keepHorizontal = keepRowOnNarrowViewport(className, resolved);
    const stackOnNarrow = narrow && !keepHorizontal && shouldStackRowOnNarrow(styles, resolved);
    if (stackOnNarrow) {
      resolved.flexDirection = "column";
      resolved.alignItems = "stretch";
    }
    const layoutAttrs = {
      ...authoredLayoutAttr(styles, resolved),
      ...(keepHorizontal ? { "data-ob-keep-row": "" as const } : {}),
    };
    return (
      <div
        ref={ref}
        className={cx("cms-group", className)}
        style={withAuthorLayout(resolved)}
        {...layoutAttrs}
      >
        {children}
      </div>
    );
  },
);
Group.displayName = "Group";

export const Divider = React.forwardRef<HTMLHRElement, { color?: string; thickness?: number; styles?: unknown }>(
  ({ color = "#e2e8f0", thickness = 1, styles }, ref) => (
    <hr
      ref={ref}
      style={applyRootBlockStyles(styles, {
        structural: { border: "none", width: "100%" },
        defaults: { borderTop: `${thickness}px solid ${color}`, margin: "24px 0" },
      })}
    />
  ),
);
Divider.displayName = "Divider";
