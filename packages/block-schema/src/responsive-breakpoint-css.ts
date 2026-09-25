/**
 * Responsive override CSS generation — shared between `styles.ts` (which props
 * can emit `--ob-r-*` vars) and `blocks-responsive-overrides.css` (container-query
 * rules that apply them). Keep the prop list aligned with `sectionToCss` output.
 */

export const RESPONSIVE_CSS_PROPS = [
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "alignContent",
  "justifyItems",
  "alignSelf",
  "flexWrap",
  "flexGrow",
  "flexShrink",
  "order",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  "gap",
  "columnGap",
  "rowGap",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "width",
  "height",
  "aspectRatio",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "fontStyle",
  "textTransform",
  "textAlign",
  "textDecoration",
  "whiteSpace",
  "textOverflow",
  "wordSpacing",
  "color",
  "backgroundColor",
  "border",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "boxShadow",
  "textShadow",
  "filter",
  "backdropFilter",
  "opacity",
  "transform",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "overflow",
  "overflowX",
  "overflowY",
  "visibility",
  "cursor",
  "mixBlendMode",
  "pointerEvents",
  "objectFit",
  "objectPosition",
] as const;

export type ResponsiveCssProp = (typeof RESPONSIVE_CSS_PROPS)[number];

/** Container-query thresholds — align with builder `BREAKPOINT_WIDTH`. */
export const RESPONSIVE_CONTAINER_BREAKPOINTS = [
  { bp: "largeDesktop", minWidth: 1440 },
  { bp: "laptop", maxWidth: 1279 },
  { bp: "tablet", maxWidth: 1023 },
  { bp: "mobile", maxWidth: 767 },
] as const;

/**
 * Non-overlapping viewport media queries for the published site (fallback when
 * the `.ob-site` container matches the viewport width, which is the common case).
 */
export const RESPONSIVE_MEDIA_BREAKPOINTS = [
  { bp: "largeDesktop", query: "(min-width: 1440px)" },
  { bp: "laptop", query: "(min-width: 1024px) and (max-width: 1279px)" },
  { bp: "tablet", query: "(min-width: 768px) and (max-width: 1023px)" },
  { bp: "mobile", query: "(max-width: 767px)" },
] as const;

/** Builder canvas preview breakpoints (matches `editorUiStore.breakpoint`). */
export const BUILDER_PREVIEW_BREAKPOINTS = [
  "largeDesktop",
  "laptop",
  "tablet",
  "mobile",
] as const;

export type BuilderPreviewBreakpoint = (typeof BUILDER_PREVIEW_BREAKPOINTS)[number];

/** Published container width → StyleModel breakpoint (excludes largeDesktop preview layer). */
export type ContainerStyleBreakpoint = "desktop" | "laptop" | "tablet" | "mobile";

/** Minimum container widths for published breakpoint resolution (strict `<` comparisons). */
export const CONTAINER_BREAKPOINT_MIN_WIDTH = {
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
} as const;

/** Hide-on-desktop applies at this container/viewport min-width and above (tablet/mobile stay visible). */
export const DESKTOP_BAND_HIDDEN_MIN_WIDTH = CONTAINER_BREAKPOINT_MIN_WIDTH.laptop;

/** Inline var emitted when `responsive.desktop.hidden` is true (`styles.ts`). */
export const DESKTOP_BAND_HIDDEN_DISPLAY_VAR = "--ob-r-desktop-band-display";

/**
 * Map a live `.ob-site` container width to the StyleModel breakpoint used for
 * inline style resolution on the published site. Aligns with
 * `RESPONSIVE_MEDIA_BREAKPOINTS` and draft preview device presets (desktop preset
 * uses the `desktop` layer, not `largeDesktop`, at 1440px+).
 */
export const resolveStyleBreakpointFromContainerWidth = (
  width: number,
): ContainerStyleBreakpoint => {
  if (width < CONTAINER_BREAKPOINT_MIN_WIDTH.tablet) return "mobile";
  if (width < CONTAINER_BREAKPOINT_MIN_WIDTH.laptop) return "tablet";
  if (width < CONTAINER_BREAKPOINT_MIN_WIDTH.desktop) return "laptop";
  return "desktop";
};

export const LARGE_DESKTOP_CONTAINER_MIN_WIDTH: number = (() => {
  for (const entry of RESPONSIVE_CONTAINER_BREAKPOINTS) {
    if (entry.bp === "largeDesktop" && "minWidth" in entry) {
      return entry.minWidth;
    }
  }

  throw new Error(
    "RESPONSIVE_CONTAINER_BREAKPOINTS must define largeDesktop.minWidth",
  );
})();

/**
 * Published container: breakpoint label (`data-ob-breakpoint`) vs authored inline
 * style resolution. When the container label is `desktop` but width is below the
 * existing `largeDesktop` container-query band, resolve authored styles like
 * Preview's Laptop preset (`laptop`, explicit inherited desktop typography).
 */
export const resolveAuthoredStyleBreakpointFromContainer = (
  width: number | undefined,
  containerBreakpoint: ContainerStyleBreakpoint,
): ContainerStyleBreakpoint => {
  if (containerBreakpoint !== "desktop") return containerBreakpoint;
  if (width == null) return "desktop";
  if (width >= LARGE_DESKTOP_CONTAINER_MIN_WIDTH) return "desktop";
  return "laptop";
};

/** Coarse viewport bucket for Row/Column stacking (`data-ob-viewport`). */
export const resolveViewportModeFromContainerWidth = (
  width: number,
): "mobile" | "tablet" | "desktop" => {
  if (width < CONTAINER_BREAKPOINT_MIN_WIDTH.tablet) return "mobile";
  if (width < CONTAINER_BREAKPOINT_MIN_WIDTH.laptop) return "tablet";
  return "desktop";
};

/** Props that also pierce `.ob-btn` descendants (buttons set their own colors). */
export const BUTTON_RESPONSIVE_PROPS: readonly ResponsiveCssProp[] = [
  "color",
  "backgroundColor",
  "fontSize",
  "fontWeight",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderRadius",
];

const camelToKebab = (s: string): string =>
  s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

const emitBreakpointPropRules = (
  lines: string[],
  selectorPrefix: string,
  bp: string,
): void => {
  for (const prop of RESPONSIVE_CSS_PROPS) {
    const cssProp = camelToKebab(prop);
    const varName = `--ob-r-${bp}-${prop}`;
    lines.push(
      `  ${selectorPrefix} [style*="${varName}"] { ${cssProp}: var(${varName}) !important; }`,
    );
    if ((BUTTON_RESPONSIVE_PROPS as readonly string[]).includes(prop)) {
      lines.push(`  ${selectorPrefix} [style*="${varName}"] .ob-btn,`);
      lines.push(
        `  ${selectorPrefix} [style*="${varName}"].ob-btn { ${cssProp}: var(${varName}) !important; }`,
      );
    }
  }
};

/** Emit container-query rules for `blocks-responsive-overrides.css`. */
export const renderResponsiveBreakpointCss = (): string => {
  const lines: string[] = [
    "/* AUTO-GENERATED — do not edit by hand.",
    "   Regenerate: bun run --cwd packages/block-schema generate-responsive-css */",
    "",
  ];

  for (const entry of RESPONSIVE_CONTAINER_BREAKPOINTS) {
    const { bp } = entry;
    const query =
      "minWidth" in entry && entry.minWidth != null
        ? `@container ob (min-width: ${entry.minWidth}px)`
        : `@container ob (max-width: ${(entry as { maxWidth: number }).maxWidth}px)`;

    lines.push(`/* ${bp.toUpperCase()} */`);
    lines.push(`${query} {`);
    emitBreakpointPropRules(lines, ".ob-site", bp);
    lines.push("}");
    lines.push("");
  }

  lines.push("/* VIEWPORT MEDIA — published site (non-overlapping ranges) */");
  lines.push("");
  for (const entry of RESPONSIVE_MEDIA_BREAKPOINTS) {
    const { bp, query } = entry;
    lines.push(`/* ${bp.toUpperCase()} */`);
    lines.push(`@media ${query} {`);
    emitBreakpointPropRules(lines, ".ob-site", bp);
    lines.push("}");
    lines.push("");
  }

  lines.push(renderDesktopBandHiddenCss());
  lines.push(renderBuilderBreakpointCss());

  return lines.join("\n");
};

/** Hide blocks flagged `responsive.desktop.hidden` at wide breakpoints only. */
export const renderDesktopBandHiddenCss = (): string => {
  const min = DESKTOP_BAND_HIDDEN_MIN_WIDTH;
  const varName = DESKTOP_BAND_HIDDEN_DISPLAY_VAR;
  const selector = `[style*="${varName}"]`;
  return [
    "/* DESKTOP-BAND HIDE — responsive.desktop.hidden (HubSpot hidden_desktop) */",
    `@container ob (min-width: ${min}px) {`,
    `  .ob-site ${selector} { display: var(${varName}) !important; }`,
    "}",
    "",
    `@media (min-width: ${min}px) {`,
    `  .ob-site ${selector} { display: var(${varName}) !important; }`,
    "}",
    "",
    `/* Builder preview — laptop / desktop / largeDesktop device frames */`,
    ...(["laptop", "desktop", "largeDesktop"] as const).map(
      (bp) =>
        `.ob-site[data-ob-breakpoint="${bp}"] ${selector} { display: var(${varName}) !important; }`,
    ),
    "",
  ].join("\n");
};

/**
 * Active-device preview rules — apply override vars for the selected breakpoint
 * (`data-ob-breakpoint` on `.ob-site`). Used by the builder canvas AND the draft
 * preview device frame. Supplements container queries so hide-on-device and
 * per-breakpoint style edits match the chosen device even when the browser
 * window is wider than the framed viewport.
 */
export const renderBuilderBreakpointCss = (): string => {
  const lines: string[] = [
    "/* ACTIVE DEVICE PREVIEW — builder canvas + draft preview (OBSiteRoot data-ob-breakpoint) */",
    "",
  ];

  for (const bp of BUILDER_PREVIEW_BREAKPOINTS) {
    const selector = `.ob-site[data-ob-breakpoint="${bp}"]`;
    lines.push(`/* PREVIEW ${bp.toUpperCase()} */`);
    emitBreakpointPropRules(lines, selector, bp);
    lines.push("");
  }

  return lines.join("\n");
};
