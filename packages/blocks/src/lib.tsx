import * as React from "react";
import {
  resolveStyles,
  responsiveCssVars,
  stateCssVars,
  interactionCssVars,
  isHiddenAtBreakpointForPreview,
  applyMiniStyles,
  sanitizeText,
  sanitizeUrl,
  sanitizeHtml,
  type StyleModel,
  type StyleBreakpoint,
  type ResolvedCss,
} from "@ob-cms/block-schema";
import { styleBreakpointRef } from "./style-breakpoint-context";

/**
 * Shared, pure, SSR-safe helpers for block components. No `window`/`document`
 * at module load. The StyleModel → CSS resolution is done here so every block
 * renders identically in the renderer (SSR) and the builder.
 */

export interface CssFromStylesOptions {
  /** When set (builder / draft preview), resolve inline styles for this breakpoint. */
  previewBreakpoint?: StyleBreakpoint;
}

/**
 * Resolve a node's `styles` StyleModel into a React style object.
 *
 * **Published site (no preview breakpoint):** desktop values resolve inline;
 * per-breakpoint overrides emit `--ob-r-<bp>-<prop>` custom properties applied by
 * container-query rules in `blocks-responsive-overrides.css`.
 *
 * **Builder / draft preview (active breakpoint set):** styles resolve inline for
 * the selected device so padding, margin, gap, typography, layout, etc. preview
 * immediately without depending on CSS-var attribute selectors.
 */
export const cssFromStyles = (
  styles: unknown,
  options: CssFromStylesOptions = {},
): React.CSSProperties => {
  const model = (styles as StyleModel) || {};
  const previewBp = options.previewBreakpoint ?? styleBreakpointRef.current;

  if (previewBp) {
    const resolved = {
      ...resolveStyles(model, previewBp, { fluid: false }),
    } as Record<string, unknown>;
    if (isHiddenAtBreakpointForPreview(model, previewBp)) {
      resolved.display = "none";
    }
    const sVars = stateCssVars(model);
    for (const k in sVars) resolved[k] = sVars[k];
    const iVars = interactionCssVars(model);
    for (const k in iVars) resolved[k] = iVars[k];
    return resolved as React.CSSProperties;
  }

  const base = resolveStyles(model) as unknown as React.CSSProperties;
  const vars = responsiveCssVars(model);
  for (const k in vars) (base as Record<string, unknown>)[k] = vars[k];
  const sVars = stateCssVars(model);
  for (const k in sVars) (base as Record<string, unknown>)[k] = sVars[k];
  const iVars = interactionCssVars(model);
  for (const k in iVars) (base as Record<string, unknown>)[k] = iVars[k];
  return base;
};

export const cssFromMini = (styles: unknown): React.CSSProperties =>
  applyMiniStyles((styles as Record<string, unknown>) || {}) as unknown as React.CSSProperties;

/**
 * Split resolved block styles between an outer Craft root wrapper and an inner
 * visual element (e.g. Button's `<a>`). CSS custom properties (`--ob-*`) and
 * layout/sizing stay on the wrapper so responsive + state rules in blocks.css
 * keep working; colors, backgrounds, borders, typography, etc. apply to the
 * inner element users actually see.
 */
const WRAPPER_STYLE_KEYS = new Set([
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "alignSelf",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "order",
  "gridColumn",
  "gridRow",
  "gridArea",
  "transform",
  "transformOrigin",
  "visibility",
  "overflow",
  "overflowX",
  "overflowY",
  "pointerEvents",
  "cursor",
]);

const TYPOGRAPHY_MINI_KEYS = [
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "fontFamily",
  "fontStyle",
  "textDecoration",
  "textTransform",
  "color",
] as const;

/**
 * Remove responsive typography CSS vars from inline styles when linkStyles (or
 * another mini-style API) already sets those properties. Without this, published
 * `blocks-responsive-overrides.css` applies `font-size: var(--ob-r-*-fontSize)
 * !important` and beats the anchor's explicit linkStyles font-size.
 */
export const stripResponsiveTypographyVars = (
  style: React.CSSProperties,
  mini: React.CSSProperties,
): React.CSSProperties => {
  const suffixes = new Set<string>();
  for (const key of TYPOGRAPHY_MINI_KEYS) {
    if (mini[key] != null && mini[key] !== "") suffixes.add(key);
  }
  if (suffixes.size === 0) return style;

  const out: Record<string, unknown> = { ...style };
  for (const varName of Object.keys(out)) {
    if (!varName.startsWith("--ob-r-")) continue;
    for (const suffix of suffixes) {
      if (varName.endsWith(`-${suffix}`)) {
        delete out[varName];
        break;
      }
    }
  }
  return out as React.CSSProperties;
};

export const splitBlockStyles = (
  resolved: React.CSSProperties,
): { wrapper: React.CSSProperties; inner: React.CSSProperties } => {
  const wrapper: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resolved)) {
    if (value === undefined || value === null || value === "") continue;
    if (key.startsWith("--") || WRAPPER_STYLE_KEYS.has(key)) {
      wrapper[key] = value;
    } else {
      inner[key] = value;
    }
  }
  return {
    wrapper: wrapper as React.CSSProperties,
    inner: inner as React.CSSProperties,
  };
};

type StyleDict = Record<string, unknown>;

/** True when the StyleModel has user-authored visual overrides (desktop layer). */
export const styleModelHasVisualOverrides = (styles: unknown): boolean => {
  const model = (styles as StyleDict) || {};
  const sections = ["colors", "spacing", "typography", "borders", "shadows", "effects", "textEffects"];
  for (const sec of sections) {
    const bag = model[sec];
    if (!bag || typeof bag !== "object") continue;
    for (const v of Object.values(bag as StyleDict)) {
      if (v !== undefined && v !== null && v !== "") return true;
    }
  }
  const responsive = model["responsive"];
  if (responsive && typeof responsive === "object" && Object.keys(responsive as object).length > 0) {
    return true;
  }
  const states = model["states"];
  if (states && typeof states === "object" && Object.keys(states as object).length > 0) {
    return true;
  }
  return false;
};

/**
 * Merge style layers so builder longhands always beat variant shorthands
 * (`background` vs `backgroundColor`, `border` vs `borderColor`, etc.).
 */
export const mergeVisualStyles = (...layers: React.CSSProperties[]): React.CSSProperties => {
  const out: Record<string, unknown> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === null || value === "") continue;
      if (key === "backgroundColor" || key === "backgroundImage") delete out.background;
      if (
        key === "borderColor" ||
        key === "borderWidth" ||
        key === "borderStyle" ||
        key.startsWith("borderTop") ||
        key.startsWith("borderRight") ||
        key.startsWith("borderBottom") ||
        key.startsWith("borderLeft")
      ) {
        delete out.border;
      }
      if (
        key === "paddingTop" ||
        key === "paddingRight" ||
        key === "paddingBottom" ||
        key === "paddingLeft"
      ) {
        delete out.padding;
      }
      if (
        key === "marginTop" ||
        key === "marginRight" ||
        key === "marginBottom" ||
        key === "marginLeft"
      ) {
        delete out.margin;
      }
      if (key === "columnGap" || key === "rowGap") {
        delete out.gap;
      }
      out[key] = value;
    }
  }
  return out as React.CSSProperties;
};

export interface SurfaceStyleOptions {
  /** Copy `--ob-*` vars from the wrapper onto the visible surface (links, buttons). */
  mirrorCssVars?: boolean;
}

/**
 * Resolve a block StyleModel into wrapper (layout + CSS vars) and surface
 * (colors, typography, borders, padding on the element users actually see).
 */
export const resolveSurfaceStyles = (
  styles: unknown,
  defaults: React.CSSProperties = {},
  partMini: React.CSSProperties = {},
  options: SurfaceStyleOptions = { mirrorCssVars: true },
): { wrapper: React.CSSProperties; surface: React.CSSProperties } => {
  const nodeCss = cssFromStyles(styles);
  const { wrapper, inner: builderVisual } = splitBlockStyles(nodeCss);
  const cssVars =
    options.mirrorCssVars !== false
      ? (Object.fromEntries(
          Object.entries(wrapper).filter(([k]) => k.startsWith("--")),
        ) as React.CSSProperties)
      : {};
  return {
    wrapper,
    // Builder StyleModel wins over legacy partStyles; CSS vars (responsive/state) last.
    surface: mergeVisualStyles(defaults, partMini, builderVisual, cssVars),
  };
};

export interface RootStyleOptions {
  /** Move `height` to `minHeight` so wrapped text never clips (headings, paragraphs). */
  heightAsMinHeight?: boolean;
  /** Applied only when the StyleModel has no visual overrides. */
  defaults?: React.CSSProperties;
  /** Always merged first (display, boxSizing, etc.). */
  structural?: React.CSSProperties;
  /** Override the active builder preview breakpoint for this resolution. */
  previewBreakpoint?: StyleBreakpoint;
}

/**
 * Standard root-element style path for single-surface blocks. Runs the full
 * cssFromStyles pipeline then merges structural/defaults without letting
 * variant shorthands fight builder longhands.
 */
export const applyRootBlockStyles = (
  styles: unknown,
  options: RootStyleOptions = {},
): React.CSSProperties => {
  const { heightAsMinHeight, defaults = {}, structural = {}, previewBreakpoint } = options;
  let resolved = cssFromStyles(styles, { previewBreakpoint });
  if (heightAsMinHeight && resolved.height != null && resolved.height !== "") {
    const { height, ...rest } = resolved;
    resolved = { ...rest, minHeight: height };
  }
  const fallback = styleModelHasVisualOverrides(styles) ? {} : defaults;
  return mergeVisualStyles(structural, fallback, resolved);
};

/** Per-part StyleModel → CSS (hero title, CTA, image sub-parts). */
export const applyPartStyles = (styles: unknown): React.CSSProperties =>
  applyRootBlockStyles(styles);

export const cx = (...parts: Array<string | false | null | undefined>): string | undefined =>
  parts.filter(Boolean).join(" ") || undefined;

/** Props that mean the author set explicit sizing via the style panel (skip fluid mobile CSS). */
const AUTHORED_SIZE_PROPS = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
]);

/** Props that mean the author set explicit typography / box styles (skip fluid mobile type CSS). */
const AUTHORED_TEXT_PROPS = new Set([
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "fontFamily",
  "fontStyle",
  "textTransform",
  "textAlign",
  "textDecoration",
  "color",
  "width",
  "height",
  "minHeight",
  "maxHeight",
  "minWidth",
  "maxWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
]);

export const hasAuthoredSizeStyle = (style: React.CSSProperties): boolean =>
  Object.entries(style).some(
    ([key, val]) => AUTHORED_SIZE_PROPS.has(key) && val != null && val !== "",
  );

export const hasAuthoredTextStyle = (style: React.CSSProperties): boolean =>
  Object.entries(style).some(
    ([key, val]) => AUTHORED_TEXT_PROPS.has(key) && val != null && val !== "",
  );

export const authoredSizeAttr = (
  style: React.CSSProperties,
): Record<string, string | undefined> =>
  hasAuthoredSizeStyle(style) ? { "data-ob-authored-size": "" } : {};

export const authoredTextAttr = (
  style: React.CSSProperties,
): Record<string, string | undefined> =>
  hasAuthoredTextStyle(style) ? { "data-ob-authored-style": "" } : {};

/** Inline CSS vars so author typography beats fluid preset `!important` rules. */
export const withAuthorTypography = (style: React.CSSProperties): React.CSSProperties => {
  if (!hasAuthoredTextStyle(style)) return style;
  const out: Record<string, unknown> = { ...style };
  if (style.fontSize != null && style.fontSize !== "") out["--ob-author-font-size"] = style.fontSize;
  if (style.lineHeight != null && style.lineHeight !== "")
    out["--ob-author-line-height"] = style.lineHeight;
  if (style.fontWeight != null && style.fontWeight !== "")
    out["--ob-author-font-weight"] = style.fontWeight;
  if (style.letterSpacing != null && style.letterSpacing !== "")
    out["--ob-author-letter-spacing"] = style.letterSpacing;
  if (style.textTransform != null && style.textTransform !== "")
    out["--ob-author-text-transform"] = style.textTransform;
  if (style.color != null && style.color !== "") out["--ob-author-color"] = style.color;
  return out as React.CSSProperties;
};

/** True when the active breakpoint layer has explicit `spacing.*` overrides (incl. 0). */
export const hasExplicitSpacingOverride = (
  styles: unknown,
  bp?: StyleBreakpoint,
): boolean => {
  const model = (styles as StyleModel) || {};
  const breakpoint = bp ?? styleBreakpointRef.current ?? "desktop";
  if (breakpoint === "desktop") {
    const spacing = model.spacing;
    if (!spacing || typeof spacing !== "object") return false;
    return Object.keys(spacing).some((k) => (spacing as Record<string, unknown>)[k] !== undefined);
  }
  const layer = (model.responsive as Record<string, unknown> | undefined)?.[breakpoint];
  if (!layer || typeof layer !== "object") return false;
  const spacing = (layer as Record<string, unknown>).spacing;
  if (!spacing || typeof spacing !== "object") return false;
  return Object.keys(spacing as object).length > 0;
};

export const authoredSpacingAttr = (
  styles: unknown,
  bp?: StyleBreakpoint,
): Record<string, string | undefined> =>
  hasExplicitSpacingOverride(styles, bp) ? { "data-ob-authored-spacing": "" } : {};

/** True when `styles.responsive.<bp>.layout.<prop>` (or desktop `layout`) is explicitly set. */
export const hasExplicitResponsiveLayoutProp = (
  styles: unknown,
  prop: string,
  bp?: StyleBreakpoint,
): boolean => {
  const model = (styles as StyleModel) || {};
  const breakpoint = bp ?? styleBreakpointRef.current ?? "desktop";
  if (breakpoint === "desktop") {
    const layout = model.layout as Record<string, unknown> | undefined;
    return layout?.[prop] !== undefined;
  }
  const layer = (model.responsive as Record<string, unknown> | undefined)?.[breakpoint];
  if (!layer || typeof layer !== "object") return false;
  const layout = (layer as Record<string, unknown>).layout;
  if (!layout || typeof layout !== "object") return false;
  return (layout as Record<string, unknown>)[prop] !== undefined;
};

/** True when mobile/tablet explicitly pins a horizontal flex direction (live site CSS opt-out). */
export const hasNarrowKeepRowOverride = (styles: unknown): boolean => {
  const model = (styles as StyleModel) || {};
  for (const bp of ["mobile", "tablet"] as StyleBreakpoint[]) {
    if (!hasExplicitResponsiveLayoutProp(styles, "flexDirection", bp)) continue;
    const layer = (model.responsive as Record<string, unknown> | undefined)?.[bp];
    const layout = (layer as Record<string, unknown> | undefined)?.layout as
      | Record<string, unknown>
      | undefined;
    const dir = String(layout?.flexDirection ?? "");
    if (dir === "row" || dir === "row-reverse") return true;
  }
  return false;
};

const isFlexRowDirection = (resolved: React.CSSProperties): boolean => {
  const display = String(resolved.display ?? "flex");
  const dir = String(resolved.flexDirection ?? "row");
  return display === "flex" && (dir === "row" || dir === "" || dir === "row-reverse");
};

/**
 * Rows that must stay horizontal on phone/tablet — explicit class, stat rows,
 * or flex rows pinned with `flexWrap: nowrap` (icon + text feature lines).
 */
export const keepRowOnNarrowViewport = (
  className: string | undefined,
  resolved: React.CSSProperties,
): boolean => {
  if (
    typeof className === "string" &&
    (className.includes("ob-stat-value-row") || className.includes("ob-keep-row"))
  ) {
    return true;
  }
  return isFlexRowDirection(resolved) && resolved.flexWrap === "nowrap";
};

/** True when a Row/Group wraps Column blocks (multi-column layout vs inline icon+text lines). */
export const rowHasColumnChildren = (children: React.ReactNode): boolean => {
  let found = false;
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const t = child.type as { displayName?: string; name?: string };
    const name = t.displayName ?? t.name;
    if (name === "Column") found = true;
  });
  return found;
};

/** Default mobile/tablet stacks rows unless the author pinned flexDirection at this breakpoint. */
export const shouldStackRowOnNarrow = (
  styles: unknown,
  resolved: React.CSSProperties,
  bp?: StyleBreakpoint,
): boolean => {
  const breakpoint = bp ?? styleBreakpointRef.current ?? "desktop";
  if (hasExplicitResponsiveLayoutProp(styles, "flexDirection", breakpoint)) {
    const dir = String(resolved.flexDirection ?? "column");
    return dir === "column" || dir === "column-reverse";
  }
  return true;
};

export const withAuthorLayout = (style: React.CSSProperties): React.CSSProperties => {
  const out: Record<string, unknown> = { ...style };
  if (style.flexDirection != null) {
    out["--ob-author-flex-direction"] = style.flexDirection;
  }
  if (style.flexWrap != null) {
    out["--ob-author-flex-wrap"] = style.flexWrap;
  }
  if (style.alignItems != null) {
    out["--ob-author-align-items"] = style.alignItems;
  }
  return out as React.CSSProperties;
};

export const authoredLayoutAttr = (
  styles: unknown,
  resolved: React.CSSProperties,
  bp?: StyleBreakpoint,
): Record<string, string | undefined> => {
  const breakpoint = bp ?? styleBreakpointRef.current ?? "desktop";
  const explicitFlexDir = hasExplicitResponsiveLayoutProp(styles, "flexDirection", breakpoint);
  const explicitOther =
    hasExplicitResponsiveLayoutProp(styles, "flexWrap", breakpoint) ||
    hasExplicitResponsiveLayoutProp(styles, "alignItems", breakpoint) ||
    hasExplicitResponsiveLayoutProp(styles, "display", breakpoint);

  if (explicitFlexDir) {
    const dir = String(resolved.flexDirection ?? "");
    if (dir === "row" || dir === "row-reverse") {
      return { "data-ob-authored-layout": "", "data-ob-keep-row": "" };
    }
    return { "data-ob-authored-layout": "" };
  }

  if (explicitOther) return { "data-ob-authored-layout": "" };

  if (styleBreakpointRef.current == null && hasNarrowKeepRowOverride(styles)) {
    return { "data-ob-keep-row": "" };
  }

  return {};
};

export { SafeLink, type SafeLinkProps } from "./safe-link";

/** Render text with an optional highlighted phrase (sanitized). */
export const HighlightedText: React.FC<{
  text?: string;
  highlightText?: string;
  highlightColor?: string;
}> = ({ text, highlightText, highlightColor = "#147eff" }) => {
  const value = text ?? "";
  if (!highlightText) {
    return <>{sanitizeText(value)}</>;
  }
  // When the highlight is a substring, color it inline. Otherwise (the common
  // hero pattern, e.g. "Remote Teams" + "That Feel In-House."), append it as a
  // highlighted block so it lands on its own line, matching the source design.
  if (!value.includes(highlightText)) {
    return (
      <>
        {sanitizeText(value)}
        <span style={{ color: highlightColor, display: "block" }}>{sanitizeText(highlightText)}</span>
      </>
    );
  }
  const [before, after] = value.split(highlightText);
  return (
    <>
      {sanitizeText(before)}
      <span style={{ color: highlightColor }}>{sanitizeText(highlightText)}</span>
      {sanitizeText(after)}
    </>
  );
};

/** Render sanitized HTML safely (allow-list sanitized first). */
export const SafeHtml: React.FC<{
  html?: string;
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
  className?: string;
}> = ({ html, as: Tag = "div", style, className }) => {
  const clean = sanitizeHtml(html);
  return React.createElement(Tag, {
    className,
    style,
    dangerouslySetInnerHTML: { __html: clean },
  });
};

/** Runs an effect only after mount — guarantees server output is static and
 *  enhancement (carousels, counters) happens client-side only. */
export const useMounted = (): boolean => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
};

// Inline editing (BlockEditingContext + EditableText) lives in the "use client"
// module `./editable-text` (it uses React.createContext, which is undefined in
// the renderer's react-server/RSC build). Blocks import it directly from there;
// it is exported to consumers via index.ts. lib.tsx stays RSC-safe.

export type { ResolvedCss };
export { sanitizeText, sanitizeUrl };
