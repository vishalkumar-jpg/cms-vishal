import { z } from "zod";

/**
 * Universal StyleModel + resolveStyles CSS engine — ported & hardened from the
 * Craft.js POC (`design-system/styles/StyleModel.js` + `resolveStyles.js`,
 * POC-AUDIT "KEEP" item). Framework-agnostic: takes a StyleModel object and
 * emits a flat CSS-property map. Token-aware — literal values pass through and
 * design tokens can be referenced via CSS variables in the value strings.
 *
 * This file has NO React / DOM dependency so it is safe in the renderer (SSR),
 * the builder, and tests.
 */

/* ------------------------------------------------------------------ */
/* StyleModel zod schema                                              */
/* ------------------------------------------------------------------ */

/** A StyleModel is an open bag of section objects; we validate loosely so that
 *  forward-compatible style keys round-trip without being dropped. */
const styleSection = z.record(z.unknown());

export const styleModelSchema = z
  .object({
    layout: styleSection.optional(),
    spacing: styleSection.optional(),
    sizing: styleSection.optional(),
    typography: styleSection.optional(),
    colors: styleSection.optional(),
    borders: styleSection.optional(),
    shadows: styleSection.optional(),
    effects: styleSection.optional(),
    position: styleSection.optional(),
    advanced: styleSection.optional(),
    hover: styleSection.optional(),
    states: z.record(z.unknown()).optional(),
    textEffects: styleSection.optional(),
    mediaEffects: styleSection.optional(),
    interaction: styleSection.optional(),
    animation: z.unknown().optional(),
    autoResponsive: z.boolean().optional(),
    responsive: z.record(z.unknown()).optional(),
    interactions: z.unknown().optional(),
    /** Author CSS scoped to this node via `[data-ob-node]` at render time. */
    customCss: z.string().optional(),
  })
  .passthrough();

export type StyleModel = z.infer<typeof styleModelSchema>;

/** A flat CSS map (subset of React.CSSProperties — kept dependency-free). */
export type ResolvedCss = Record<string, string | number | undefined>;

import {
  RESPONSIVE_CSS_PROPS,
  type ResponsiveCssProp,
} from "./responsive-breakpoint-css";

type Dict = Record<string, any>;

/** All preview / style breakpoints (desktop = base layer). */
export type StyleBreakpoint =
  | "desktop"
  | "largeDesktop"
  | "laptop"
  | "tablet"
  | "mobile";

/** Breakpoints that store sparse overrides under `styles.responsive.<bp>`. */
export const STYLE_OVERRIDE_BREAKPOINTS = [
  "largeDesktop",
  "laptop",
  "tablet",
  "mobile",
] as const;

export type StyleOverrideBreakpoint = (typeof STYLE_OVERRIDE_BREAKPOINTS)[number];

/** Parent breakpoint used for cascade inheritance (editing + CSS var diffing). */
export const styleBreakpointParent = (bp: StyleBreakpoint): StyleBreakpoint => {
  switch (bp) {
    case "largeDesktop":
    case "laptop":
      return "desktop";
    case "tablet":
      return "laptop";
    case "mobile":
      return "tablet";
    default:
      return "desktop";
  }
};

/* ------------------------------------------------------------------ */
/* Defaults / empty model                                            */
/* ------------------------------------------------------------------ */

export const emptyStyles = (): StyleModel => ({
  layout: {},
  spacing: {},
  sizing: {},
  typography: {},
  colors: {},
  borders: {},
  shadows: {},
  effects: {},
  position: {},
  advanced: {},
  hover: {},
  states: { hover: {}, active: {}, focus: {}, visited: {}, disabled: {} },
  textEffects: {},
  mediaEffects: {},
  interaction: {
    transitionDuration: 0.25,
    transitionDelay: 0,
    transitionTiming: "ease-out",
  },
  animation: null,
  autoResponsive: true,
  responsive: {
    desktop: {},
    largeDesktop: {},
    laptop: {},
    tablet: {},
    mobile: {},
    __auto: { tablet: true, mobile: true },
  },
});

const isPlainObject = (v: unknown): v is Dict =>
  v != null && typeof v === "object" && !Array.isArray(v);

const asDict = (v: unknown): Dict => (isPlainObject(v) ? v : {});

/** Deep-merge StyleModel defaults with a component's incoming `styles`. */
export function mergeStyleDefaults(
  componentProps: Dict = {},
): Dict {
  const base = emptyStyles() as Dict;
  const incoming: Dict = (componentProps.styles as Dict) || {};
  const mergeSection = (target: Dict, source: unknown): Dict =>
    isPlainObject(source) ? { ...target, ...source } : target;
  const states = (incoming.states as Dict) || {};
  const responsive = (incoming.responsive as Dict) || {};
  const baseResp = base.responsive as Dict;
  const baseStates = base.states as Dict;

  return {
    ...componentProps,
    styles: {
      ...base,
      ...incoming,
      layout: mergeSection(base.layout, incoming.layout),
      spacing: mergeSection(base.spacing, incoming.spacing),
      sizing: mergeSection(base.sizing, incoming.sizing),
      typography: mergeSection(base.typography, incoming.typography),
      colors: mergeSection(base.colors, incoming.colors),
      borders: mergeSection(base.borders, incoming.borders),
      shadows: mergeSection(base.shadows, incoming.shadows),
      effects: mergeSection(base.effects, incoming.effects),
      position: mergeSection(base.position, incoming.position),
      advanced: mergeSection(base.advanced, incoming.advanced),
      hover: mergeSection(base.hover, incoming.hover),
      states: {
        hover: mergeSection(baseStates.hover, states.hover),
        active: mergeSection(baseStates.active, states.active),
        focus: mergeSection(baseStates.focus, states.focus),
        visited: mergeSection(baseStates.visited, states.visited),
        disabled: mergeSection(baseStates.disabled, states.disabled),
      },
      textEffects: mergeSection(base.textEffects, incoming.textEffects),
      mediaEffects: mergeSection(base.mediaEffects, incoming.mediaEffects),
      interaction: mergeSection(base.interaction, incoming.interaction),
      responsive: {
        ...baseResp,
        ...responsive,
        desktop: mergeSection(baseResp.desktop, responsive.desktop),
        largeDesktop: mergeSection(baseResp.largeDesktop, responsive.largeDesktop),
        laptop: mergeSection(baseResp.laptop, responsive.laptop),
        tablet: mergeSection(baseResp.tablet, responsive.tablet),
        mobile: mergeSection(baseResp.mobile, responsive.mobile),
        __auto: { ...(baseResp.__auto as Dict), ...(responsive.__auto as Dict) },
      },
      animation: incoming.animation ?? base.animation,
      autoResponsive: incoming.autoResponsive ?? base.autoResponsive,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Fluid CSS helpers (ported from responsive/fluidCss.js)            */
/* ------------------------------------------------------------------ */

const MIN_VW = 320;
const MAX_VW = 1280;

const parsePx = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.endsWith("px")) return parseFloat(value);
  return null;
};

const fluidClamp = (minPx: number, maxPx: number): string => {
  const min = Math.round(Math.min(minPx, maxPx));
  const max = Math.round(Math.max(minPx, maxPx));
  if (min === max) return `${max}px`;
  const slope = (max - min) / (MAX_VW - MIN_VW);
  const intercept = min - slope * MIN_VW;
  return `clamp(${min}px, ${intercept.toFixed(2)}px + ${(slope * 100).toFixed(4)}vw, ${max}px)`;
};

const fluidFontSize = (desktopPx: number): string => {
  const min = Math.max(12, Math.round(desktopPx * 0.5));
  return fluidClamp(min, desktopPx);
};

const fluidSpacing = (desktopPx: number): string => {
  const min = Math.max(0, Math.round(desktopPx * 0.45));
  return fluidClamp(min, desktopPx);
};

const isAutoResponsiveEnabled = (styles: Dict = {}): boolean => styles.autoResponsive !== false;

const applyFluidToCss = (css: ResolvedCss, merged: Dict = {}): ResolvedCss => {
  const next: ResolvedCss = { ...css };
  if (next.fontSize) {
    const px = parsePx(next.fontSize);
    if (px != null && px >= 14) next.fontSize = fluidFontSize(px);
  }
  const spaceKeys = [
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "marginTop", "marginRight", "marginBottom", "marginLeft", "gap",
  ] as const;
  for (const key of spaceKeys) {
    if (next[key]) {
      const px = parsePx(next[key]);
      if (px != null && px > 0) next[key] = fluidSpacing(px);
    }
  }
  if (next.width) {
    const w = parsePx(next.width);
    if (w != null && w > 400) {
      next.width = "100%";
      if (!next.maxWidth) next.maxWidth = `${w}px`;
    }
  }
  if (!next.maxWidth && merged.sizing?.maxWidth != null) {
    const mw = merged.sizing.maxWidth;
    next.maxWidth = typeof mw === "number" ? `${mw}px` : mw;
  }
  return next;
};

/* ------------------------------------------------------------------ */
/* Style -> CSS resolution (ported from resolveStyles.js)            */
/* ------------------------------------------------------------------ */

const toPx = (v: unknown): string | undefined =>
  v != null && v !== "" ? (typeof v === "number" ? `${v}px` : (v as string)) : undefined;

const buildGradientCss = (gradient: Dict | undefined): string | undefined => {
  if (!gradient) return undefined;
  const { type = "linear", angle = 135, stops = [] } = gradient;
  if (!Array.isArray(stops) || !stops.length) return undefined;
  const stopStr = stops.map((s: Dict) => `${s.color} ${s.position}%`).join(", ");
  if (type === "radial") return `radial-gradient(circle, ${stopStr})`;
  if (type === "conic") return `conic-gradient(from ${angle}deg, ${stopStr})`;
  return `linear-gradient(${angle}deg, ${stopStr})`;
};

const resolveBackgroundGradient = (colors: Dict = {}): string | undefined =>
  buildGradientCss(colors.backgroundGradient) ??
  (!colors.gradientText ? buildGradientCss(colors.gradient) : undefined);

const resolveTextGradient = (colors: Dict = {}): string | undefined =>
  buildGradientCss(colors.textGradient) ??
  (colors.gradientText ? buildGradientCss(colors.gradient) : undefined);

const buildBackgroundImage = (colors: Dict = {}): string | undefined => {
  const bgGrad = resolveBackgroundGradient(colors);
  const textGrad = resolveTextGradient(colors);
  const gradientTextActive = colors.gradientText || !!colors.textGradient;
  const overlayColor = colors.backgroundOverlayColor as string | undefined;
  const overlayOpacity = colors.backgroundOverlayOpacity as number | undefined;
  const overlayGrad =
    overlayColor && overlayOpacity != null && overlayOpacity > 0
      ? (() => {
          const hex = overlayColor.startsWith("#") ? overlayColor : "#000000";
          const r = parseInt(hex.slice(1, 3), 16) || 0;
          const g = parseInt(hex.slice(3, 5), 16) || 0;
          const b = parseInt(hex.slice(5, 7), 16) || 0;
          return `linear-gradient(rgba(${r},${g},${b},${overlayOpacity}), rgba(${r},${g},${b},${overlayOpacity}))`;
        })()
      : undefined;

  let imagePart: string | undefined;
  if (colors.backgroundImage) {
    const url = String(colors.backgroundImage).startsWith("url(")
      ? colors.backgroundImage
      : `url(${colors.backgroundImage})`;
    imagePart = url;
  }

  const layers: string[] = [];
  if (overlayGrad) layers.push(overlayGrad);
  if (bgGrad && !gradientTextActive) layers.push(bgGrad);
  if (imagePart) layers.push(imagePart);
  if (textGrad && gradientTextActive) layers.push(textGrad);

  if (layers.length === 0) {
    if (textGrad && bgGrad && gradientTextActive) return `${textGrad}, ${bgGrad}`;
    if (textGrad && gradientTextActive) return textGrad;
    return bgGrad;
  }
  return layers.join(", ");
};

const buildTransform = (transform: Dict = {}): string | undefined => {
  const parts: string[] = [];
  if (transform.translateX || transform.translateY)
    parts.push(`translate3d(${transform.translateX || 0}px, ${transform.translateY || 0}px, 0)`);
  if (transform.scale != null && transform.scale !== 1) parts.push(`scale(${transform.scale})`);
  if (transform.rotate) parts.push(`rotate(${transform.rotate}deg)`);
  if (transform.skewX) parts.push(`skewX(${transform.skewX}deg)`);
  if (transform.skewY) parts.push(`skewY(${transform.skewY}deg)`);
  return parts.length ? parts.join(" ") : undefined;
};

const buildFilter = (effects: Dict = {}, mediaEffects: Dict = {}): string | undefined => {
  const src = { ...effects, ...mediaEffects };
  const parts: string[] = [];
  if (src.blur) parts.push(`blur(${src.blur}px)`);
  if (src.brightness != null && src.brightness !== 100) parts.push(`brightness(${src.brightness}%)`);
  if (src.contrast != null && src.contrast !== 100) parts.push(`contrast(${src.contrast}%)`);
  if (src.saturate != null && src.saturate !== 100) parts.push(`saturate(${src.saturate}%)`);
  if (src.grayscale) parts.push(`grayscale(${src.grayscale}%)`);
  return parts.length ? parts.join(" ") : undefined;
};

const buildTextEffects = (textEffects: Dict = {}, shadows: Dict = {}): ResolvedCss => {
  const out: ResolvedCss = {};
  if (textEffects.strokeWidth)
    out.WebkitTextStroke = `${textEffects.strokeWidth}px ${textEffects.strokeColor || "#000"}`;
  if (textEffects.glow) {
    const c = textEffects.glowColor || "#3b82f6";
    const i = textEffects.glowIntensity ?? 12;
    out.textShadow = shadows.textShadow || `0 0 ${i}px ${c}, 0 0 ${i * 2}px ${c}`;
  }
  if (textEffects.outline) {
    out.WebkitTextStroke = `${textEffects.outlineWidth || 1}px ${textEffects.outlineColor || "#000"}`;
    out.color = "transparent";
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Responsive overrides -> CSS custom properties                      */
/* ------------------------------------------------------------------ */

export {
  RESPONSIVE_CSS_PROPS,
  type ResponsiveCssProp,
  CONTAINER_BREAKPOINT_MIN_WIDTH,
  LARGE_DESKTOP_CONTAINER_MIN_WIDTH,
  DESKTOP_BAND_HIDDEN_DISPLAY_VAR,
  resolveStyleBreakpointFromContainerWidth,
  resolveAuthoredStyleBreakpointFromContainer,
  resolveViewportModeFromContainerWidth,
  type ContainerStyleBreakpoint,
} from "./responsive-breakpoint-css";

import { DESKTOP_BAND_HIDDEN_DISPLAY_VAR as DESKTOP_BAND_HIDDEN_VAR } from "./responsive-breakpoint-css";

const RESPONSIVE_OVERRIDE_BPS: StyleOverrideBreakpoint[] = [
  "largeDesktop",
  "laptop",
  "tablet",
  "mobile",
];

/** Top-level style sections only (excludes `responsive` / `states` metadata). */
const baseStyleSections = (styles: StyleModel): Dict => {
  const { responsive, states, ...rest } = styles as Dict;
  return rest;
};

/**
 * Merge the desktop base with breakpoint override layers in cascade order.
 * Each breakpoint only adds its own sparse `responsive.<bp>` layer on top of
 * inherited parent values — editing one breakpoint never touches another.
 */
export const mergeStyleModelAtBreakpoint = (
  styles: StyleModel = {},
  breakpoint: StyleBreakpoint = "desktop",
): StyleModel => {
  const responsive = asDict((styles as Dict).responsive);
  let merged = baseStyleSections(styles);

  if (breakpoint === "largeDesktop") {
    merged = mergeBreakpoint(merged, responsive.largeDesktop);
  } else if (breakpoint === "laptop") {
    merged = mergeBreakpoint(merged, responsive.laptop);
  } else if (breakpoint === "tablet") {
    merged = mergeBreakpoint(
      mergeBreakpoint(merged, responsive.laptop),
      responsive.tablet,
    );
  } else if (breakpoint === "mobile") {
    merged = mergeBreakpoint(
      mergeBreakpoint(
        mergeBreakpoint(merged, responsive.laptop),
        responsive.tablet,
      ),
      responsive.mobile,
    );
  }

  // Legacy: `responsive.desktop` merged into the base desktop layer.
  if (breakpoint === "desktop" && responsive.desktop) {
    merged = mergeBreakpoint(merged, responsive.desktop);
  }

  return merged as StyleModel;
};

/** Is this breakpoint marked hidden in the model? */
export const isHiddenAtBreakpoint = (styles: StyleModel | undefined, bp: StyleBreakpoint): boolean => {
  const responsive = asDict((styles as Dict)?.responsive);
  const layer = asDict(responsive[bp]);
  return layer.hidden === true;
};

/** Builder preview bands that honor `responsive.desktop.hidden` (wide viewports). */
export const isDesktopBandStyleBreakpoint = (bp: StyleBreakpoint): boolean =>
  bp === "desktop" || bp === "largeDesktop" || bp === "laptop";

/** Hide checks for builder/preview — desktop-band flags apply to laptop/desktop/largeDesktop. */
export const isHiddenAtBreakpointForPreview = (
  styles: StyleModel | undefined,
  bp: StyleBreakpoint,
): boolean => {
  if (isDesktopBandStyleBreakpoint(bp)) {
    return isHiddenAtBreakpoint(styles, "desktop") || isHiddenAtBreakpoint(styles, bp);
  }
  return isHiddenAtBreakpoint(styles, bp);
};

const isHiddenAt = isHiddenAtBreakpoint;

/** True when `styles.responsive.<bp>` explicitly sets a CSSProperty (any section). */
const isExplicitResponsiveProp = (layer: Dict, prop: string): boolean => {
  const sections = [
    "layout",
    "spacing",
    "sizing",
    "typography",
    "colors",
    "borders",
    "shadows",
    "effects",
    "position",
    "advanced",
    "textEffects",
    "mediaEffects",
  ];
  for (const name of sections) {
    if (asDict(layer[name])[prop] !== undefined) return true;
  }
  return false;
};

/**
 * Resolve a StyleModel's per-breakpoint overrides into a flat bag of inline CSS
 * custom properties (e.g. `--ob-r-mobile-paddingTop: 8px`). Only properties that
 * actually CHANGE versus the resolved desktop value are emitted, so unchanged
 * pages emit nothing (byte-identical backward-compat). `blocks.css` applies these
 * vars inside `@container ob (max-width: …)` rules, giving editor/renderer parity
 * (the canvas is a width-constrained `.ob-site` container, the renderer the real
 * viewport — both container-query contexts).
 *
 * Also emits `--ob-r-<bp>-display: none` when a breakpoint is flagged hidden.
 */
export const responsiveCssVars = (styles: StyleModel = {}): ResolvedCss => {
  const responsive = asDict((styles as Dict).responsive);
  const vars: ResolvedCss = {};

  for (const bp of RESPONSIVE_OVERRIDE_BPS) {
    const layer = asDict(responsive[bp]);
    const hasLayer = Object.keys(layer).some((k) => k !== "hidden" && isPlainObject(layer[k]));
    const hidden = isHiddenAt(styles, bp);

    if (hasLayer) {
      const parent = styleBreakpointParent(bp);
      const resolved = resolveStyles(styles, bp, { fluid: false });
      const parentResolved = resolveStyles(styles, parent, { fluid: false });

      for (const prop of RESPONSIVE_CSS_PROPS) {
        if (hidden && prop === "display") continue;
        const bpVal = resolved[prop];
        if (bpVal == null) continue;
        const explicit = isExplicitResponsiveProp(layer, prop);
        if (bpVal === parentResolved[prop] && !explicit) continue;
        vars[`--ob-r-${bp}-${prop}`] = bpVal;
      }
    }

    if (hidden) {
      vars[`--ob-r-${bp}-display`] = "none";
    }
  }

  if (isHiddenAt(styles, "desktop")) {
    vars[DESKTOP_BAND_HIDDEN_VAR] = "none";
  }

  return vars;
};

/* ------------------------------------------------------------------ */
/* Element-state overrides (hover / focus / active) -> CSS variables   */
/* ------------------------------------------------------------------ */

/**
 * The interactive states a block can carry overrides for. Each maps to a real
 * CSS pseudo-class (`:hover` / `:focus-visible` / `:active`) emitted in
 * `blocks.css`. Pure CSS → SSR-safe + editor/renderer identical.
 */
export const STATE_NAMES = ["hover", "focus", "active", "visited", "disabled"] as const;
export type StateName = (typeof STATE_NAMES)[number];

/**
 * High-value CSS properties a state override can drive. Mirrors the per-prop
 * CSS-var pattern of `RESPONSIVE_CSS_PROPS`: each state diffs its resolved value
 * vs the base and emits `--ob-s-<state>-<prop>` ONLY when it actually changes,
 * consumed by `[style*="--ob-s-<state>-<prop>"]:<pseudo>` rules in `blocks.css`.
 */
export const STATE_CSS_PROPS = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "borderColor",
  "border",
  "boxShadow",
  "opacity",
  "transform",
  "filter",
  "textDecoration",
] as const;

export type StateCssProp = (typeof STATE_CSS_PROPS)[number];

/** Default transition applied (once) whenever ANY state override exists, so the
 *  state change animates. Overridable via `styles.interaction.transition` or the
 *  `buildTransitionCss` duration/timing inputs. */
export const DEFAULT_STATE_TRANSITION =
  "color, background-color, background-image, border-color, box-shadow, opacity, transform, text-decoration 150ms ease";

const asStates = (styles: Dict): Dict => asDict(styles.states);

/** Does this StyleModel carry any non-empty interactive-state override? */
export const hasStateOverrides = (styles: StyleModel = {}): boolean => {
  const states = asStates(styles as Dict);
  return STATE_NAMES.some((s) => {
    const layer = asDict(states[s]);
    return Object.keys(layer).some((k) => isPlainObject(layer[k]) && Object.keys(layer[k]).length > 0);
  });
};

/**
 * Resolve a StyleModel's interactive-state overrides (hover/focus/active) into a
 * flat bag of inline CSS custom properties (e.g. `--ob-s-hover-backgroundColor`).
 * Only properties that actually CHANGE versus the resolved base value are emitted
 * (byte-identical backward-compat for state-less blocks).
 *
 * COMPOSES WITH RESPONSIVE: states are resolved by merging the state layer ON TOP
 * of the BASE (desktop) style, then diffed against the base. The emitted
 * `:hover`/`:focus`/`:active` rules use `!important` and apply at every breakpoint,
 * so a hover override stays active regardless of the responsive (`--ob-r-*`) vars
 * — base, responsive and state vars all live on the same inline style without
 * clobbering (different var namespaces, different selectors). Precedence at a
 * breakpoint while interacting: state pseudo-rule wins (it is `!important` and more
 * specific via the pseudo-class) over the responsive `!important` base rule.
 */
export const stateCssVars = (styles: StyleModel = {}): ResolvedCss => {
  const states = asStates(styles as Dict);
  const vars: ResolvedCss = {};
  // Base (desktop, no fluid) — we diff literal values, not clamps.
  const base = resolveStyles(styles, "desktop", { fluid: false });

  let emitted = false;
  for (const state of STATE_NAMES) {
    const layer = asDict(states[state]);
    const hasLayer = Object.keys(layer).some(
      (k) => isPlainObject(layer[k]) && Object.keys(layer[k]).length > 0,
    );
    if (!hasLayer) continue;
    // Merge the state layer over the base (same section-merge as breakpoints),
    // then resolve so gradient/border/transform composites are built correctly.
    const merged = mergeBreakpoint({ ...(styles as Dict) }, layer);
    const resolved = resolveStyles(merged as StyleModel, "desktop", { fluid: false });
    for (const prop of STATE_CSS_PROPS) {
      const val = resolved[prop];
      if (val == null) continue;
      if (val === base[prop]) continue; // unchanged → don't emit
      vars[`--ob-s-${state}-${prop}`] = val;
      emitted = true;
    }
  }

  if (emitted) {
    // A transition so the state change animates. User-supplied transition wins.
    const interaction = asDict((styles as Dict).interaction);
    const userTransition =
      buildTransitionCss(interaction) || (asDict((styles as Dict).effects).transition as string);
    if (!base.transition && !userTransition) {
      vars["--ob-s-transition"] = DEFAULT_STATE_TRANSITION;
    }
  }
  return vars;
};

export const buildTransitionCss = (interaction: Dict = {}): string | undefined => {
  const duration = interaction.transitionDuration ?? interaction.duration;
  const delay = interaction.transitionDelay ?? interaction.delay;
  const timing = interaction.transitionTiming ?? interaction.easing ?? "ease";
  if (duration == null && !interaction.transition) return interaction.transition || undefined;
  const props =
    interaction.transitionProperty ||
    "transform, opacity, box-shadow, background-color, background-image, color, border-color, filter";
  const dur = duration != null ? `${duration}s` : "0.25s";
  const del = delay != null ? ` ${delay}s` : "";
  return `${props} ${dur}${del} ${timing}`;
};

const BORDER_SIDES = ["Top", "Right", "Bottom", "Left"] as const;

const applyBorderCss = (css: ResolvedCss, borders: Dict = {}): void => {
  const borderGrad = buildGradientCss(borders.gradient);
  const hasBorderColor = borders.borderColor != null && borders.borderColor !== "";
  const borderWidth = borders.borderWidth != null ? borders.borderWidth : hasBorderColor ? 1 : 0;
  const style = borders.borderStyle || "solid";
  if (borderGrad) {
    const w = borders.borderWidth != null && borders.borderWidth > 0 ? borders.borderWidth : 2;
    css.border = `${toPx(w)} ${style} transparent`;
    css.borderImage = `${borderGrad} 1`;
    css.borderImageSlice = 1;
    return;
  }
  // Per-side border (optional): if any side has its own width/color, emit the
  // four longhands (falling back to the base width/color) instead of the
  // `border` shorthand — this avoids shorthand/longhand ordering conflicts and
  // lets a user border only one side or colour each side independently.
  const hasPerSide = BORDER_SIDES.some(
    (s) =>
      (borders[`border${s}Color`] != null && borders[`border${s}Color`] !== "") ||
      borders[`border${s}Width`] != null,
  );
  if (hasPerSide) {
    for (const s of BORDER_SIDES) {
      const sideColor = borders[`border${s}Color`];
      const color = sideColor != null && sideColor !== "" ? sideColor : hasBorderColor ? borders.borderColor : undefined;
      const sideWidth = borders[`border${s}Width`];
      const width = sideWidth != null ? sideWidth : borderWidth > 0 ? borderWidth : color ? 1 : 0;
      if (width > 0 || color) {
        css[`border${s}Width`] = toPx(width > 0 ? width : 1);
        css[`border${s}Style`] = style;
        css[`border${s}Color`] = color || "#e2e8f0";
      }
    }
    return;
  }
  if (borderWidth > 0 || hasBorderColor) {
    const w = borderWidth > 0 ? borderWidth : 1;
    css.border = `${toPx(w)} ${style} ${borders.borderColor || "#e2e8f0"}`;
  }
};

const num = (v: unknown): string | undefined =>
  v != null ? (typeof v === "number" ? toPx(v) : (v as string)) : undefined;

const mergeBreakpoint = (base: Dict, bp: Dict | undefined): Dict => {
  if (!bp) return base;
  const sect = (k: string) => ({ ...(base[k] || {}), ...(bp[k] || {}) });
  return {
    ...base,
    layout: sect("layout"),
    spacing: sect("spacing"),
    sizing: sect("sizing"),
    typography: sect("typography"),
    colors: sect("colors"),
    borders: sect("borders"),
    shadows: sect("shadows"),
    effects: sect("effects"),
    position: sect("position"),
    advanced: sect("advanced"),
    hover: sect("hover"),
    states: sect("states"),
    textEffects: sect("textEffects"),
    mediaEffects: sect("mediaEffects"),
    interaction: sect("interaction"),
  };
};

const sectionToCss = (merged: Dict): ResolvedCss => {
  const {
    layout = {}, spacing = {}, sizing = {}, typography = {}, colors = {},
    borders = {}, shadows = {}, effects = {}, position = {}, advanced = {},
    textEffects = {}, mediaEffects = {}, interaction = {},
  } = merged;

  const bgImage = buildBackgroundImage(colors);
  const bgGrad = resolveBackgroundGradient(colors);
  const textGrad = resolveTextGradient(colors);
  const gradientTextActive = colors.gradientText || !!colors.textGradient;
  const filter = buildFilter(effects, mediaEffects);
  const textFx = buildTextEffects(textEffects, shadows);

  const css: ResolvedCss = {
    display: layout.display,
    flexDirection: layout.flexDirection,
    justifyContent: layout.justifyContent,
    alignItems: layout.alignItems,
    alignContent: layout.alignContent,
    justifyItems: layout.justifyItems,
    alignSelf: layout.alignSelf,
    flexWrap: layout.flexWrap,
    flexGrow: layout.flexGrow,
    flexShrink: layout.flexShrink,
    order: layout.order,
    gridTemplateColumns:
      layout.gridTemplateColumns ??
      (typeof layout.columns === "number"
        ? `repeat(${layout.columns}, minmax(0, 1fr))`
        : undefined),
    gridTemplateRows: layout.gridTemplateRows,
    gridAutoFlow: layout.gridAutoFlow,
    gap: toPx(spacing.gap ?? layout.gap),
    columnGap: toPx(layout.columnGap ?? spacing.columnGap),
    rowGap: toPx(layout.rowGap ?? spacing.rowGap),
    marginTop: toPx(spacing.marginTop),
    marginRight: toPx(spacing.marginRight),
    marginBottom: toPx(spacing.marginBottom),
    marginLeft: toPx(spacing.marginLeft),
    paddingTop: toPx(spacing.paddingTop),
    paddingRight: toPx(spacing.paddingRight),
    paddingBottom: toPx(spacing.paddingBottom),
    paddingLeft: toPx(spacing.paddingLeft),
    width: num(sizing.width),
    height: num(sizing.height),
    aspectRatio: sizing.aspectRatio,
    minWidth: num(sizing.minWidth),
    maxWidth: num(sizing.maxWidth),
    minHeight: num(sizing.minHeight),
    maxHeight: num(sizing.maxHeight),
    fontFamily: typography.fontFamily,
    fontSize: toPx(typography.fontSize),
    fontWeight: typography.fontWeight,
    lineHeight: typography.lineHeight,
    letterSpacing:
      typography.letterSpacing == null || typography.letterSpacing === ""
        ? undefined
        : typeof typography.letterSpacing === "number"
          ? `${typography.letterSpacing}px`
          : typography.letterSpacing,
    fontStyle: typography.fontStyle,
    textTransform: typography.textTransform,
    textAlign: typography.textAlign,
    textDecoration: typography.textDecoration,
    whiteSpace: typography.whiteSpace,
    textOverflow: typography.textOverflow,
    wordSpacing:
      typography.wordSpacing == null || typography.wordSpacing === ""
        ? undefined
        : typeof typography.wordSpacing === "number"
          ? `${typography.wordSpacing}px`
          : typography.wordSpacing,
    color:
      textGrad && gradientTextActive && !colors.textColor
        ? "transparent"
        : colors.textColor || typography.textColor || typography.color,
    backgroundColor: bgGrad ? undefined : colors.backgroundColor,
    backgroundImage: bgImage,
    backgroundSize: colors.backgroundSize || (colors.backgroundImage ? "cover" : undefined),
    backgroundPosition: colors.backgroundPosition || (colors.backgroundImage ? "center" : undefined),
    backgroundRepeat: colors.backgroundRepeat || (colors.backgroundImage ? "no-repeat" : undefined),
    backgroundAttachment: colors.backgroundAttachment as string | undefined,
    transformOrigin: (effects.transformOrigin as string | undefined) ?? (effects.transform as Dict)?.transformOrigin as string | undefined,
    WebkitBackgroundClip:
      textGrad && gradientTextActive ? (bgGrad ? "text, border-box" : "text") : undefined,
    WebkitTextFillColor: textGrad && gradientTextActive ? "transparent" : undefined,
    backgroundClip: textGrad && gradientTextActive ? (bgGrad ? "text, border-box" : "text") : undefined,
    borderRadius: borders.borderRadius != null ? toPx(borders.borderRadius) : undefined,
    borderTopLeftRadius: borders.borderTopLeftRadius != null ? toPx(borders.borderTopLeftRadius) : undefined,
    borderTopRightRadius: borders.borderTopRightRadius != null ? toPx(borders.borderTopRightRadius) : undefined,
    borderBottomLeftRadius: borders.borderBottomLeftRadius != null ? toPx(borders.borderBottomLeftRadius) : undefined,
    borderBottomRightRadius: borders.borderBottomRightRadius != null ? toPx(borders.borderBottomRightRadius) : undefined,
    boxShadow: shadows.boxShadow,
    textShadow: shadows.textShadow,
    filter,
    backdropFilter: effects.backdropBlur ? `blur(${effects.backdropBlur}px)` : undefined,
    opacity: effects.opacity,
    transform: buildTransform(effects.transform || {}),
    transition: buildTransitionCss(interaction) || effects.transition,
    position: position.position,
    top: toPx(position.top),
    right: toPx(position.right),
    bottom: toPx(position.bottom),
    left: toPx(position.left),
    zIndex: position.zIndex,
    overflow: advanced.overflow,
    overflowX: advanced.overflowX,
    overflowY: advanced.overflowY,
    visibility: advanced.visibility,
    cursor: advanced.cursor,
    mixBlendMode: advanced.mixBlendMode,
    pointerEvents: advanced.pointerEvents,
    objectFit: advanced.objectFit || mediaEffects.objectFit,
    objectPosition: mediaEffects.objectPosition,
    ...textFx,
  };

  applyBorderCss(css, borders);

  if (effects.glassmorphism) {
    css.backgroundColor = colors.backgroundColor || "rgba(255,255,255,0.1)";
    css.backdropFilter = `blur(${effects.backdropBlur || 12}px)`;
    const hasUserBorder =
      borders.borderWidth > 0 ||
      (borders.borderColor != null && borders.borderColor !== "") ||
      borders.gradient;
    if (!hasUserBorder && !css.border) css.border = "1px solid rgba(255,255,255,0.2)";
  }

  for (const k of Object.keys(css)) if (css[k] === undefined) delete css[k];
  return css;
};

export interface ResolveStylesOptions {
  fluid?: boolean;
  forceFluid?: boolean;
}

/**
 * Resolve a StyleModel into a flat CSS map. Pure & deterministic — identical
 * output server- and client-side (no `window`/`document`).
 */
export const resolveStyles = (
  styles: StyleModel = {},
  breakpoint: StyleBreakpoint = "desktop",
  options: ResolveStylesOptions = {},
): ResolvedCss => {
  const { fluid = true, forceFluid = false } = options;
  const merged = mergeStyleModelAtBreakpoint(styles, breakpoint);
  const css = sectionToCss(merged);

  const transition = buildTransitionCss(merged.interaction);
  if (transition) css.transition = transition;

  for (const k of Object.keys(css)) if (css[k] === undefined) delete css[k];

  const useFluid =
    (fluid || forceFluid) && isAutoResponsiveEnabled(styles) && breakpoint === "desktop";
  return useFluid ? applyFluidToCss(css, merged) : css;
};

/* ------------------------------------------------------------------ */
/* applyMiniStyles — flat per-part style objects (ported)            */
/* ------------------------------------------------------------------ */

export const applyMiniStyles = (styles: Dict = {}): ResolvedCss => {
  if (!styles || typeof styles !== "object") return {};
  const css: ResolvedCss = {};
  const px = (v: unknown): string | undefined =>
    v != null && v !== "" ? (typeof v === "number" ? `${v}px` : (v as string)) : undefined;
  if (styles.fontSize != null) css.fontSize = px(styles.fontSize);
  if (styles.fontWeight != null) css.fontWeight = styles.fontWeight;
  if (styles.color) css.color = styles.color;
  if (styles.backgroundColor) css.backgroundColor = styles.backgroundColor;
  if (styles.background && !styles.backgroundColor) css.backgroundColor = styles.background;
  if (styles.textAlign) css.textAlign = styles.textAlign;
  if (styles.lineHeight != null) css.lineHeight = styles.lineHeight;
  if (styles.padding != null) css.padding = px(styles.padding);
  if (styles.paddingX != null) css.paddingLeft = css.paddingRight = px(styles.paddingX);
  if (styles.paddingY != null) css.paddingTop = css.paddingBottom = px(styles.paddingY);
  if (styles.paddingTop != null) css.paddingTop = px(styles.paddingTop);
  if (styles.paddingBottom != null) css.paddingBottom = px(styles.paddingBottom);
  if (styles.paddingLeft != null) css.paddingLeft = px(styles.paddingLeft);
  if (styles.paddingRight != null) css.paddingRight = px(styles.paddingRight);
  if (styles.marginTop != null) css.marginTop = px(styles.marginTop);
  if (styles.marginBottom != null) css.marginBottom = px(styles.marginBottom);
  if (styles.borderRadius != null) css.borderRadius = px(styles.borderRadius);
  if (styles.border) css.border = styles.border;
  if (styles.boxShadow) css.boxShadow = styles.boxShadow;
  if (styles.width != null) css.width = typeof styles.width === "number" ? px(styles.width) : styles.width;
  if (styles.height != null) css.height = typeof styles.height === "number" ? px(styles.height) : styles.height;
  if (styles.minHeight != null) css.minHeight = px(styles.minHeight);
  if (styles.objectFit) css.objectFit = styles.objectFit;
  if (styles.opacity != null) css.opacity = styles.opacity;
  if (styles.display) css.display = styles.display;
  if (styles.fontFamily) css.fontFamily = styles.fontFamily;
  if (styles.fontStyle) css.fontStyle = styles.fontStyle;
  if (styles.letterSpacing != null) css.letterSpacing = styles.letterSpacing;
  if (styles.textTransform) css.textTransform = styles.textTransform;
  if (styles.textDecoration) css.textDecoration = styles.textDecoration;
  return css;
};

export { buildGradientCss };

/* ================================================================== */
/* SCROLL / ENTRANCE INTERACTIONS (reveal-on-scroll + parallax)        */
/* ------------------------------------------------------------------ */
/* A node carries an optional `interactions` shape (stored as a sibling */
/* section inside its StyleModel so it flows through the SAME           */
/* `cssFromStyles(styles)` path every block already calls → editor +    */
/* renderer parity with ZERO per-block edits). `interactionCssVars`     */
/* turns it into inline CSS custom properties; absent → emits nothing   */
/* (byte-identical backward-compat). The `blocks.css` rules + the       */
/* renderer `ScrollFX` script key off the presence of those vars        */
/* (`[style*="--ob-reveal-effect"]`) — the same marker pattern used by  */
/* the responsive (`--ob-r-*`) and state (`--ob-s-*`) systems.          */
/* ================================================================== */

export const REVEAL_EFFECTS = [
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "zoom",
] as const;
export type RevealEffect = (typeof REVEAL_EFFECTS)[number];

export interface RevealInteraction {
  effect: RevealEffect;
  /** seconds */
  duration?: number;
  /** seconds */
  delay?: number;
  /** animate only the first time it enters the viewport (default true) */
  once?: boolean;
}

export interface ParallaxInteraction {
  /** translateY factor relative to scroll; 0 = none. e.g. 0.2 → moves 20% of scroll. */
  speed: number;
}

/* ------------------------------------------------------------------ */
/* ANIMATION PRESETS (one-click) + TRIGGERS                           */
/* ------------------------------------------------------------------ */
/* A curated, apply-in-one-click layer on top of the raw reveal model. */
/* Each preset pairs a motion with a sensible default trigger; the CSS  */
/* (blocks.css) + ScrollFX runtime key off the emitted `--ob-anim-*`    */
/* inline vars — same marker pattern as reveal/parallax → editor +      */
/* renderer parity, SSR-safe, and nothing emitted when unset.          */

export const ANIMATION_PRESETS = [
  "none",
  "fade-in",
  "slide-up",
  "zoom-in",
  "bounce-in",
  "rotate-in",
  "flip-in",
  "glow-hover",
  "lift-hover",
  "pulse-hover",
  "shake-hover",
] as const;
export type AnimationPreset = (typeof ANIMATION_PRESETS)[number];

export const ANIMATION_TRIGGERS = ["load", "scroll", "hover", "click"] as const;
export type AnimationTrigger = (typeof ANIMATION_TRIGGERS)[number];

export const ANIMATION_EASINGS = [
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "linear",
  "cubic-bezier(0.34, 1.56, 0.64, 1)",
] as const;
export type AnimationEasing = (typeof ANIMATION_EASINGS)[number];

export interface AnimationInteraction {
  preset: AnimationPreset;
  /** When the animation plays. Falls back to the preset's natural default. */
  trigger?: AnimationTrigger;
  /** seconds */
  duration?: number;
  /** seconds */
  delay?: number;
  /** Stagger delay between child elements (seconds) */
  stagger?: number;
  /** CSS easing function */
  easing?: AnimationEasing | string;
  /** for scroll trigger — animate only the first time it enters (default true) */
  once?: boolean;
}

/** Continuous hover presets are inherently hover-driven; entrance presets default to scroll. */
export const HOVER_PRESETS: ReadonlySet<AnimationPreset> = new Set([
  "glow-hover",
  "lift-hover",
  "pulse-hover",
  "shake-hover",
]);

/** The natural trigger for a preset when the author hasn't chosen one. */
export const defaultTriggerFor = (preset: AnimationPreset): AnimationTrigger =>
  HOVER_PRESETS.has(preset) ? "hover" : "scroll";

export interface Interactions {
  reveal?: RevealInteraction;
  parallax?: ParallaxInteraction;
  animation?: AnimationInteraction;
}

const DEFAULT_REVEAL_DURATION = 0.6;
const DEFAULT_REVEAL_DELAY = 0;

/** Read the `interactions` shape from a node's StyleModel (or a bare object). */
export const getInteractions = (styles: unknown): Interactions | undefined => {
  const i = asDict(styles).interactions;
  return isPlainObject(i) ? (i as Interactions) : undefined;
};

/** Does this node carry any active scroll/entrance interaction? */
export const hasInteractions = (styles: unknown): boolean => {
  const i = getInteractions(styles);
  if (!i) return false;
  const reveal = i.reveal && i.reveal.effect && i.reveal.effect !== "none";
  const parallax = i.parallax && typeof i.parallax.speed === "number" && i.parallax.speed !== 0;
  const animation = i.animation && i.animation.preset && i.animation.preset !== "none";
  return Boolean(reveal || parallax || animation);
};

/**
 * Resolve a node's `interactions` into a flat bag of inline CSS custom
 * properties consumed by the `blocks.css` reveal/parallax rules + the renderer
 * `ScrollFX` script. Pure & SSR-safe (string work only). Emits NOTHING when no
 * interaction is set (so unchanged pages stay byte-identical).
 *
 *  reveal  → `--ob-reveal-effect`, `--ob-reveal-dur`, `--ob-reveal-delay`,
 *            and `--ob-reveal-once: 0` when `once === false`.
 *  parallax→ `--ob-parallax-speed`.
 */
export const interactionCssVars = (styles: unknown): ResolvedCss => {
  const i = getInteractions(styles);
  if (!i) return {};
  const vars: ResolvedCss = {};

  const reveal = i.reveal;
  if (reveal && reveal.effect && reveal.effect !== "none") {
    vars["--ob-reveal-effect"] = reveal.effect;
    const dur = typeof reveal.duration === "number" ? reveal.duration : DEFAULT_REVEAL_DURATION;
    const del = typeof reveal.delay === "number" ? reveal.delay : DEFAULT_REVEAL_DELAY;
    vars["--ob-reveal-dur"] = `${dur}s`;
    vars["--ob-reveal-delay"] = `${del}s`;
    // The script reads this to decide whether to keep observing (default once).
    if (reveal.once === false) vars["--ob-reveal-once"] = "0";
  }

  const parallax = i.parallax;
  if (parallax && typeof parallax.speed === "number" && parallax.speed !== 0) {
    vars["--ob-parallax-speed"] = String(parallax.speed);
  }

  const animation = i.animation;
  if (animation && animation.preset && animation.preset !== "none") {
    vars["--ob-anim-preset"] = animation.preset;
    vars["--ob-anim-trigger"] = animation.trigger ?? defaultTriggerFor(animation.preset);
    const dur = typeof animation.duration === "number" ? animation.duration : DEFAULT_REVEAL_DURATION;
    const del = typeof animation.delay === "number" ? animation.delay : DEFAULT_REVEAL_DELAY;
    vars["--ob-anim-dur"] = `${dur}s`;
    vars["--ob-anim-delay"] = `${del}s`;
    if (animation.easing) vars["--ob-anim-easing"] = animation.easing;
    if (typeof animation.stagger === "number" && animation.stagger > 0) {
      vars["--ob-anim-stagger"] = `${animation.stagger}s`;
    }
    // Scroll trigger observes-once by default; opt out keeps it re-animating.
    if (animation.once === false) vars["--ob-anim-once"] = "0";
  }

  return vars;
};
