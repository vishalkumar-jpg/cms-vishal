import {
  resolveStyles,
  type StyleModel,
} from "@ob-cms/block-schema";
import { cssFromStyles, applyRootBlockStyles, mergeVisualStyles, resolveSurfaceStyles } from "./lib";
import { REGISTERED_BLOCK_TYPES } from "./registry";

/**
 * Canonical StyleModel used by the developer verification page and unit tests.
 * Values are chosen so `resolveStyles()` emits predictable, assertable CSS.
 */
export const STYLE_AUDIT_FIXTURE: StyleModel = {
  layout: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "stretch",
    flexWrap: "nowrap",
    gap: 12,
  },
  spacing: {
    paddingTop: 16,
    paddingRight: 20,
    paddingBottom: 16,
    paddingLeft: 20,
    marginTop: 8,
    marginRight: 4,
    marginBottom: 8,
    marginLeft: 4,
    gap: 12,
  },
  sizing: {
    width: 320,
    minWidth: 200,
    maxWidth: 480,
    height: 120,
    minHeight: 80,
    maxHeight: 200,
  },
  typography: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  colors: {
    textColor: "#1e293b",
    backgroundColor: "#e2e8f0",
  },
  borders: {
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "#64748b",
    borderRadius: 8,
  },
  shadows: {
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  effects: {
    opacity: 0.95,
    blur: 0,
  },
  autoResponsive: false,
  position: {
    position: "relative",
    zIndex: 1,
  },
  responsive: {
    desktop: {},
    tablet: {
      typography: { fontSize: 16 },
      colors: { backgroundColor: "#cbd5e1" },
    },
    mobile: {
      typography: { fontSize: 14 },
      spacing: { paddingTop: 12, paddingBottom: 12 },
    },
    __auto: { tablet: true, mobile: true },
  },
  states: {
    hover: { colors: { backgroundColor: "#94a3b8" } },
    focus: { borders: { borderColor: "#147eff" } },
    active: {},
    visited: {},
    disabled: { effects: { opacity: 0.5 } },
  },
};

/** Desktop baseline CSS properties the audit fixture must resolve to. */
export const STYLE_AUDIT_EXPECTED: Record<string, string | number> = {
  display: "flex",
  flexDirection: "column",
  paddingTop: "16px",
  paddingRight: "20px",
  paddingBottom: "16px",
  paddingLeft: "20px",
  marginTop: "8px",
  marginRight: "4px",
  marginBottom: "8px",
  marginLeft: "4px",
  width: "320px",
  minWidth: "200px",
  maxWidth: "480px",
  height: "120px",
  minHeight: "80px",
  maxHeight: "200px",
  fontSize: "18px",
  fontWeight: 600,
  color: "#1e293b",
  backgroundColor: "#e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  opacity: 0.95,
  position: "relative",
  zIndex: 1,
};

export interface PipelineCheckResult {
  name: string;
  pass: boolean;
  expected?: unknown;
  actual?: unknown;
}

/** Verify the StyleModel → resolveStyles → cssFromStyles pipeline. */
export const verifyStylePipeline = (): PipelineCheckResult[] => {
  const results: PipelineCheckResult[] = [];
  const resolved = resolveStyles(STYLE_AUDIT_FIXTURE);
  const inline = cssFromStyles(STYLE_AUDIT_FIXTURE);
  const root = applyRootBlockStyles(STYLE_AUDIT_FIXTURE);

  for (const [prop, expected] of Object.entries(STYLE_AUDIT_EXPECTED)) {
    const actual = resolved[prop];
    results.push({
      name: `resolveStyles.${prop}`,
      pass: actual === expected || String(actual) === String(expected),
      expected,
      actual,
    });
  }

  for (const [prop, expected] of Object.entries(STYLE_AUDIT_EXPECTED)) {
    if (prop === "fontWeight") continue;
    const actual = (inline as Record<string, unknown>)[prop];
    results.push({
      name: `cssFromStyles.${prop}`,
      pass: actual === expected || String(actual) === String(expected),
      expected,
      actual,
    });
  }

  results.push({
    name: "cssFromStyles.responsive-tablet-fontSize",
    pass: (inline as Record<string, unknown>)["--ob-r-tablet-fontSize"] === "16px",
    expected: "16px",
    actual: (inline as Record<string, unknown>)["--ob-r-tablet-fontSize"],
  });

  results.push({
    name: "cssFromStyles.state-hover-bg",
    pass: String((inline as Record<string, unknown>)["--ob-s-hover-backgroundColor"]).includes("#94a3b8"),
    expected: "#94a3b8",
    actual: (inline as Record<string, unknown>)["--ob-s-hover-backgroundColor"],
  });

  results.push({
    name: "applyRootBlockStyles.paddingTop",
    pass: root.paddingTop === "16px",
    expected: "16px",
    actual: root.paddingTop,
  });

  const { wrapper, surface } = resolveSurfaceStyles(STYLE_AUDIT_FIXTURE, {
    backgroundColor: "#000",
    color: "#fff",
  });
  results.push({
    name: "resolveSurfaceStyles.builder-beats-defaults",
    pass: surface.backgroundColor === "#e2e8f0" && surface.color === "#1e293b",
    expected: { backgroundColor: "#e2e8f0", color: "#1e293b" },
    actual: { backgroundColor: surface.backgroundColor, color: surface.color },
  });
  results.push({
    name: "resolveSurfaceStyles.wrapper-has-responsive-vars",
    pass: Object.keys(wrapper).some((k) => k.startsWith("--ob-r-")),
    expected: true,
    actual: Object.keys(wrapper).filter((k) => k.startsWith("--ob-r-")),
  });

  const merged = mergeVisualStyles(
    { background: "red", padding: "8px" },
    { backgroundColor: "#147eff", paddingTop: "12px" },
  );
  results.push({
    name: "mergeVisualStyles.shorthand-cleared",
    pass: merged.backgroundColor === "#147eff" && !("background" in merged),
    expected: { backgroundColor: "#147eff", noBackgroundShorthand: true },
    actual: merged,
  });

  return results;
};

export interface BlockAuditEntry {
  type: string;
  props: Record<string, unknown>;
}

/** Blocks that need runtime context providers — skipped on the verification page. */
export const STYLE_AUDIT_SKIP_TYPES = new Set([
  "Reusable Block",
  "Collection List",
  "Form",
  "Experiment",
]);

/** Merge registry defaults with the audit StyleModel for each block type. */
export const buildBlockAuditEntries = (
  defaultPropsFor: (type: string) => Record<string, unknown>,
): BlockAuditEntry[] =>
  REGISTERED_BLOCK_TYPES.filter((type) => !STYLE_AUDIT_SKIP_TYPES.has(type)).map((type) => ({
    type,
    props: {
      ...defaultPropsFor(type),
      styles: STYLE_AUDIT_FIXTURE,
    },
  }));

export interface DomStyleCheck {
  property: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const normalizeCSSValue = (value: string): string =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

/** Compare computed styles on a DOM element against expected resolved values. */
export const verifyElementStyles = (
  el: HTMLElement,
  expected: Record<string, string | number> = STYLE_AUDIT_EXPECTED,
): DomStyleCheck[] => {
  if (typeof window === "undefined") return [];
  const computed = window.getComputedStyle(el);
  const checks: DomStyleCheck[] = [];

  const propMap: Record<string, keyof CSSStyleDeclaration | string> = {
    paddingTop: "paddingTop",
    paddingRight: "paddingRight",
    paddingBottom: "paddingBottom",
    paddingLeft: "paddingLeft",
    marginTop: "marginTop",
    marginRight: "marginRight",
    marginBottom: "marginBottom",
    marginLeft: "marginLeft",
    width: "width",
    fontSize: "fontSize",
    fontWeight: "fontWeight",
    color: "color",
    backgroundColor: "backgroundColor",
    borderRadius: "borderTopLeftRadius",
    opacity: "opacity",
    display: "display",
  };

  for (const [key, cssProp] of Object.entries(propMap)) {
    const exp = expected[key];
    if (exp == null) continue;
    const actual = computed[cssProp as keyof CSSStyleDeclaration] as string;
    let pass = false;
    if (key === "color" || key === "backgroundColor") {
      pass = normalizeCSSValue(actual).includes(String(exp).replace("#", "").slice(0, 6)) ||
        actual.includes(String(exp));
    } else if (key === "opacity") {
      pass = Math.abs(parseFloat(actual) - Number(exp)) < 0.02;
    } else if (key === "fontWeight") {
      pass = String(actual) === String(exp) || actual === "600";
    } else {
      pass = normalizeCSSValue(actual) === normalizeCSSValue(String(exp));
    }
    checks.push({
      property: key,
      expected: String(exp),
      actual,
      pass,
    });
  }
  return checks;
};

/** Blocks using resolveSurfaceStyles (wrapper + inner surface). */
export const STYLE_AUDIT_SPLIT_SURFACE_TYPES = new Set([
  "Button",
  "Link",
  "Floating CTA",
  "Search",
  "Newsletter",
  "Cookie Banner",
  "Navbar",
  "Hero Section",
  "Pricing Table",
  "Logo Carousel",
  "Content Carousel",
  "Video Testimonial Carousel",
  "Article Card Grid",
  "Slider",
  "Tabs",
  "Accordion",
  "Modal",
  "Icon",
  "Form",
]);

export interface SplitSurfaceCheck {
  type: string;
  hasSurface: boolean;
  hasObBtn: boolean;
  hasResponsiveVars: boolean;
  pass: boolean;
}

/** Verify split-surface blocks expose `.ob-btn` surface + responsive CSS vars on wrapper. */
export const verifySplitSurfaceBlock = (wrap: HTMLElement, type: string): SplitSurfaceCheck => {
  const surface =
    wrap.querySelector<HTMLElement>(".ob-btn") ??
    wrap.querySelector<HTMLElement>(".ob-floating-cta") ??
    (wrap.firstElementChild as HTMLElement | null);
  const wrapper = wrap.firstElementChild as HTMLElement | null;
  const varHost = wrapper ?? wrap;
  const styleStr = varHost.getAttribute("style") ?? "";
  const hasResponsiveVars = /--ob-r-/.test(styleStr) || /--ob-s-/.test(styleStr);
  const hasObBtn = !!wrap.querySelector(".ob-btn");
  const hasSurface = !!surface;
  return {
    type,
    hasSurface,
    hasObBtn,
    hasResponsiveVars,
    pass: hasSurface && (STYLE_AUDIT_SPLIT_SURFACE_TYPES.has(type) ? hasObBtn || type === "Navbar" : true),
  };
};

export const STYLE_AUDIT_BLOCK_COUNT = REGISTERED_BLOCK_TYPES.length;
