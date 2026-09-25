/**
 * Auto-responsive generation + responsive audit — pure, dependency-free helpers
 * (no React/DOM) so they run identically in the builder, the renderer and tests.
 *
 * The builder authors a desktop-first StyleModel. On save/publish we derive
 * tablet + mobile override layers from the desktop values with a few safe
 * heuristics, storing them in the SAME `styles.responsive.{tablet,mobile}` shape
 * the resolve engine (`resolveStyles` / `responsiveCssVars`) already consumes —
 * so generated layouts render with zero extra wiring.
 *
 * Auto-generated keys are tracked in `styles.responsive.__generated` so that:
 *   - re-generation refreshes them when the desktop value changes, and
 *   - a user's MANUAL per-breakpoint override is never clobbered.
 */

type Dict = Record<string, any>;

const isObj = (v: unknown): v is Dict =>
  v != null && typeof v === "object" && !Array.isArray(v);
const asDict = (v: unknown): Dict => (isObj(v) ? v : {});

/** Container widths the responsive container-queries switch at (see blocks.css). */
export const RESP_TABLET_W = 768;
export const RESP_MOBILE_W = 390;

/** Smallest comfortably-readable body font (px). */
export const MIN_READABLE_FONT = 12;
/** Target font we bump unreadable text up to when fixing. */
export const FIX_FONT_TARGET = 14;

/** Proportional font shrink per breakpoint. */
const TABLET_FONT_SCALE = 0.85;
const MOBILE_FONT_SCALE = 0.72;

/** Parse a CSS length to px number, or null for %, auto, vw, unset, etc. */
const toPxNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (s.endsWith("px")) {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    }
    if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  }
  return null;
};

const isPercentWidth = (v: unknown): boolean =>
  typeof v === "string" && v.trim().endsWith("%");

/** A fixed width is one expressed in px (not %, auto, vw, fr…). */
const isFixedWidth = (v: unknown): boolean => toPxNum(v) != null;

/** One auto override to apply at a breakpoint. */
interface AutoEdit {
  section: string;
  key: string;
  value: string | number;
}

/** Read a section from the desktop base (top-level + responsive.desktop layer). */
const baseSection = (styles: Dict, name: string): Dict => {
  const responsive = asDict(styles.responsive);
  return { ...asDict(styles[name]), ...asDict(asDict(responsive.desktop)[name]) };
};

/** Compute the desired auto edits for a breakpoint from the desktop base. */
const computeEdits = (styles: Dict, bp: "tablet" | "mobile"): AutoEdit[] => {
  const layout = baseSection(styles, "layout");
  const typography = baseSection(styles, "typography");
  const sizing = baseSection(styles, "sizing");
  const edits: AutoEdit[] = [];

  // 1) Proportionally reduce font size.
  const fs = toPxNum(typography.fontSize);
  if (fs != null && fs > MIN_READABLE_FONT) {
    const scale = bp === "tablet" ? TABLET_FONT_SCALE : MOBILE_FONT_SCALE;
    // Never shrink below readable, and only emit when it actually gets smaller.
    const scaled = Math.max(FIX_FONT_TARGET, Math.round(fs * scale));
    if (scaled < fs) edits.push({ section: "typography", key: "fontSize", value: scaled });
  }

  // 2) Stack columns on mobile (flex rows → column; grids → single column).
  const display = String(layout.display ?? "");
  const dir = String(layout.flexDirection ?? "row");
  const gridCols = layout.gridTemplateColumns;

  if (bp === "tablet") {
    if (display === "flex" && (dir === "row" || dir === "row-reverse")) {
      edits.push({ section: "layout", key: "flexDirection", value: "column" });
    }
    if (display === "grid" && gridCols && gridCols !== "1fr") {
      edits.push({
        section: "layout",
        key: "gridTemplateColumns",
        value: "repeat(2, minmax(0, 1fr))",
      });
    }
  }

  if (bp === "mobile") {
    if (display === "flex" && (dir === "row" || dir === "row-reverse")) {
      edits.push({ section: "layout", key: "flexDirection", value: "column" });
    }
    if (display === "grid" && gridCols && gridCols !== "1fr") {
      edits.push({ section: "layout", key: "gridTemplateColumns", value: "1fr" });
    }
  }

  // 3) Convert fixed widths → fluid when they'd exceed the breakpoint.
  if (isFixedWidth(sizing.width)) {
    const w = toPxNum(sizing.width) as number;
    const limit = bp === "tablet" ? RESP_TABLET_W : RESP_MOBILE_W;
    if (w > limit - 32) {
      edits.push({ section: "sizing", key: "width", value: "100%" });
    }
  } else if (isPercentWidth(sizing.width) && bp === "mobile") {
    const pct = parseFloat(String(sizing.width));
    if (Number.isFinite(pct) && pct < 100) {
      edits.push({ section: "sizing", key: "width", value: "100%" });
    }
  }

  return edits;
};

const flagKey = (e: AutoEdit): string => `${e.section}.${e.key}`;

/** Remove previously auto-generated keys from a layer (leaves manual keys). */
const stripGenerated = (layer: Dict, prevFlags: Dict): Dict => {
  const next: Dict = { ...layer };
  for (const flag of Object.keys(prevFlags)) {
    const [section, key] = flag.split(".");
    if (isObj(next[section])) {
      const sect = { ...next[section] };
      delete sect[key];
      if (Object.keys(sect).length === 0) delete next[section];
      else next[section] = sect;
    }
  }
  return next;
};

/**
 * Generate tablet + mobile override layers for a node's StyleModel. Idempotent
 * and non-destructive: refreshes its own auto keys, never touches manual ones.
 * Returns a NEW styles object (or the same reference when nothing applies).
 */
export const generateResponsiveStyles = (styles: unknown): Dict => {
  const model = asDict(styles);
  // Respect the global opt-out toggle (Style panel "Fluid auto-scaling" off).
  if (model.autoResponsive === false) return model;

  const responsive = asDict(model.responsive);
  const auto = { tablet: true, mobile: true, ...asDict(responsive.__auto) };
  const prevGen = asDict(responsive.__generated);
  const nextResponsive: Dict = { ...responsive };
  const nextGen: Dict = { ...prevGen };
  let changed = false;

  for (const bp of ["tablet", "mobile"] as const) {
    if (auto[bp] === false) continue;
    // Start from the manual keys only (strip our previous auto keys).
    const layer = stripGenerated(asDict(responsive[bp]), asDict(prevGen[bp]));
    const edits = computeEdits(model, bp);
    const genFlags: Dict = {};

    for (const e of edits) {
      const existing = asDict(layer[e.section])[e.key];
      // A manual override for this exact key wins — don't overwrite it.
      if (existing !== undefined) continue;
      layer[e.section] = { ...asDict(layer[e.section]), [e.key]: e.value };
      genFlags[flagKey(e)] = true;
    }

    nextResponsive[bp] = layer;
    nextGen[bp] = genFlags;
    changed = true;
  }

  if (!changed) return model;
  nextResponsive.__generated = nextGen;
  return { ...model, responsive: nextResponsive };
};

/* ------------------------------------------------------------------ */
/* Responsive audit (pure static analysis)                            */
/* ------------------------------------------------------------------ */

export type ResponsiveRule = "mobile-overflow" | "fixed-width" | "small-font";
export type ResponsiveSeverity = "error" | "warn";

export interface ResponsiveFix {
  /** Dot path into the node's props (e.g. `styles.responsive.mobile.sizing.width`). */
  path: string;
  value: string | number;
  label: string;
}

export interface ResponsiveFinding {
  rule: ResponsiveRule;
  severity: ResponsiveSeverity;
  message: string;
  fix?: ResponsiveFix;
}

/** The effective value at a breakpoint = base overridden by that bp's layer. */
const effectiveAt = (styles: Dict, bp: "mobile" | "tablet", section: string, key: string): unknown => {
  const responsive = asDict(styles.responsive);
  const layer = asDict(asDict(responsive[bp])[section]);
  if (layer[key] !== undefined) return layer[key];
  return baseSection(styles, section)[key];
};

/**
 * Statically audit a node's StyleModel for common mobile problems. Pure — the
 * admin hook adds nodeId + can layer DOM-measured overflow on top.
 */
export const auditResponsiveStyles = (styles: unknown): ResponsiveFinding[] => {
  const model = asDict(styles);
  const findings: ResponsiveFinding[] = [];

  // --- Fixed width / mobile overflow -----------------------------------
  const mobileWidth = effectiveAt(model, "mobile", "sizing", "width");
  if (isFixedWidth(mobileWidth)) {
    const w = toPxNum(mobileWidth) as number;
    if (w > RESP_MOBILE_W - 32) {
      findings.push({
        rule: "mobile-overflow",
        severity: "error",
        message: `Fixed width ${w}px is wider than a phone screen (~${RESP_MOBILE_W}px) and will overflow.`,
        fix: {
          path: "styles.responsive.mobile.sizing.width",
          value: "100%",
          label: "Make full-width on mobile",
        },
      });
    } else {
      findings.push({
        rule: "fixed-width",
        severity: "warn",
        message: `Fixed width (${w}px) doesn't adapt to smaller screens.`,
        fix: {
          path: "styles.responsive.mobile.sizing.width",
          value: "100%",
          label: "Make full-width on mobile",
        },
      });
    }
  }

  // --- Unreadable font size on mobile ----------------------------------
  const mobileFont = toPxNum(effectiveAt(model, "mobile", "typography", "fontSize"));
  if (mobileFont != null && mobileFont < MIN_READABLE_FONT) {
    findings.push({
      rule: "small-font",
      severity: "warn",
      message: `Text is only ${mobileFont}px on mobile — hard to read (aim for ${FIX_FONT_TARGET}px+).`,
      fix: {
        path: "styles.responsive.mobile.typography.fontSize",
        value: FIX_FONT_TARGET,
        label: `Bump to ${FIX_FONT_TARGET}px`,
      },
    });
  }

  return findings;
};
