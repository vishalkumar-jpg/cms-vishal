/**
 * Token scales for the style controls. Colors map to the design-system CSS
 * variables (from @ob-cms/ui tokens.css) so block styling stays theme-driven —
 * choosing "Primary" writes `hsl(var(--primary))`, which re-themes with the site.
 */
export interface ColorToken {
  label: string;
  value: string;
}

export const COLOR_TOKENS: ColorToken[] = [
  { label: "None", value: "" },
  { label: "Background", value: "hsl(var(--background))" },
  { label: "Foreground", value: "hsl(var(--foreground))" },
  { label: "Primary", value: "hsl(var(--primary))" },
  { label: "Primary Fg", value: "hsl(var(--primary-foreground))" },
  { label: "Secondary", value: "hsl(var(--secondary))" },
  { label: "Muted", value: "hsl(var(--muted))" },
  { label: "Muted Fg", value: "hsl(var(--muted-foreground))" },
  { label: "Accent", value: "hsl(var(--accent))" },
  { label: "Card", value: "hsl(var(--card))" },
];

/** Spacing token scale (px), mirrors the --space-* tokens / a 4px base scale. */
export const SPACING_SCALE: { label: string; value: number }[] = [
  { label: "0", value: 0 },
  { label: "xs (8)", value: 8 },
  { label: "sm (16)", value: 16 },
  { label: "md (24)", value: 24 },
  { label: "lg (48)", value: 48 },
  { label: "xl (80)", value: 80 },
  { label: "2xl (128)", value: 128 },
];

export const FONT_SIZE_SCALE: { label: string; value: number }[] = [
  { label: "xs (12)", value: 12 },
  { label: "sm (14)", value: 14 },
  { label: "base (16)", value: 16 },
  { label: "lg (18)", value: 18 },
  { label: "xl (20)", value: 20 },
  { label: "2xl (24)", value: 24 },
  { label: "3xl (30)", value: 30 },
  { label: "4xl (36)", value: 36 },
  { label: "5xl (48)", value: 48 },
];

export const FONT_WEIGHTS = ["300", "400", "500", "600", "700", "800"];
export const TEXT_ALIGN = ["left", "center", "right", "justify"];
export const DISPLAY_OPTIONS = ["block", "flex", "grid", "inline-block", "none"];
export const FLEX_DIRECTION = ["row", "column", "row-reverse", "column-reverse"];
export const JUSTIFY_CONTENT = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
];
export const ALIGN_ITEMS = ["stretch", "flex-start", "center", "flex-end"];
export const BORDER_STYLES = ["none", "solid", "dashed", "dotted"];
export const SHADOW_PRESETS: { label: string; value: string }[] = [
  { label: "None", value: "none" },
  { label: "Small", value: "0 1px 2px rgba(0,0,0,0.08)" },
  { label: "Medium", value: "0 4px 12px rgba(0,0,0,0.12)" },
  { label: "Large", value: "0 12px 32px rgba(0,0,0,0.18)" },
];

export type Breakpoint = "largeDesktop" | "desktop" | "laptop" | "tablet" | "mobile";

/* ------------------------------------------------------------------ */
/* Deep typography                                                    */
/* ------------------------------------------------------------------ */

export const TEXT_TRANSFORM = ["none", "uppercase", "lowercase", "capitalize"];
export const TEXT_DECORATION = ["none", "underline", "line-through", "overline"];
export const FONT_STYLE = ["normal", "italic"];

/** Line-height token scale (unitless multipliers). */
export const LINE_HEIGHT_SCALE: { label: string; value: number }[] = [
  { label: "None (1)", value: 1 },
  { label: "Tight (1.1)", value: 1.1 },
  { label: "Snug (1.25)", value: 1.25 },
  { label: "Normal (1.5)", value: 1.5 },
  { label: "Relaxed (1.75)", value: 1.75 },
  { label: "Loose (2)", value: 2 },
];

/** Letter-spacing token scale (px). */
export const LETTER_SPACING_SCALE: { label: string; value: number }[] = [
  { label: "Tighter (-1)", value: -1 },
  { label: "Tight (-0.5)", value: -0.5 },
  { label: "Normal (0)", value: 0 },
  { label: "Wide (0.5)", value: 0.5 },
  { label: "Wider (1)", value: 1 },
  { label: "Widest (2)", value: 2 },
];

/**
 * One-click text styles — apply a whole typographic "role" (size + weight +
 * line-height + spacing) in one tap so non-technical users get readable,
 * hierarchy-correct text without tuning five separate fields.
 */
export interface TextStylePreset {
  label: string;
  typography: Record<string, number | string>;
}

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    label: "Display",
    typography: { fontSize: 48, fontWeight: "700", lineHeight: 1.1, letterSpacing: -0.5 },
  },
  {
    label: "Heading",
    typography: { fontSize: 30, fontWeight: "600", lineHeight: 1.25, letterSpacing: 0 },
  },
  {
    label: "Subheading",
    typography: { fontSize: 20, fontWeight: "600", lineHeight: 1.25, letterSpacing: 0 },
  },
  {
    label: "Body",
    typography: { fontSize: 16, fontWeight: "400", lineHeight: 1.5, letterSpacing: 0 },
  },
  {
    label: "Caption",
    typography: { fontSize: 14, fontWeight: "400", lineHeight: 1.5, letterSpacing: 0 },
  },
  {
    label: "Overline",
    typography: { fontSize: 12, fontWeight: "600", lineHeight: 1.5, letterSpacing: 1, textTransform: "uppercase" },
  },
];

/**
 * Recommended font pairings (heading + body). Non-technical users pick a "look"
 * rather than guessing which fonts go together.
 */
export const FONT_PAIRINGS: { label: string; heading: string; body: string }[] = [
  { label: "Modern (Inter × Inter)", heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
  { label: "Editorial (Playfair × Lora)", heading: "'Playfair Display', Georgia, serif", body: "Lora, Georgia, serif" },
  { label: "Friendly (Poppins × Open Sans)", heading: "Poppins, system-ui, sans-serif", body: "'Open Sans', system-ui, sans-serif" },
  { label: "Corporate (Montserrat × Roboto)", heading: "Montserrat, system-ui, sans-serif", body: "Roboto, system-ui, sans-serif" },
];

/** Curated web-font picker. "Theme font" inherits the site's font stack. */
export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Theme font", value: "" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "System UI", value: "system-ui, -apple-system, sans-serif" },
  { label: "Geist", value: "Geist, system-ui, sans-serif" },
  { label: "Roboto", value: "Roboto, system-ui, sans-serif" },
  { label: "Open Sans", value: "'Open Sans', system-ui, sans-serif" },
  { label: "Montserrat", value: "Montserrat, system-ui, sans-serif" },
  { label: "Poppins", value: "Poppins, system-ui, sans-serif" },
  { label: "Lora (serif)", value: "Lora, Georgia, serif" },
  { label: "Playfair (serif)", value: "'Playfair Display', Georgia, serif" },
  { label: "Merriweather (serif)", value: "Merriweather, Georgia, serif" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Menlo (mono)", value: "Menlo, Consolas, monospace" },
];

/* ------------------------------------------------------------------ */
/* Layout (flex / grid)                                               */
/* ------------------------------------------------------------------ */

/** 3 justify-content options for the alignment matrix columns. */
export const MATRIX_JUSTIFY = ["flex-start", "center", "flex-end"];
/** 3 align-items options for the alignment matrix rows. */
export const MATRIX_ALIGN = ["flex-start", "center", "flex-end"];
export const FLEX_WRAP = ["nowrap", "wrap", "wrap-reverse"];
export const GRID_AUTO_FLOW = ["row", "column", "dense"];
/** Common grid track presets offered per-track. */
export const GRID_TRACK_PRESETS = ["1fr", "2fr", "auto", "min-content", "max-content"];

/* ------------------------------------------------------------------ */
/* Gradient                                                           */
/* ------------------------------------------------------------------ */

export const GRADIENT_TYPES = ["linear", "radial", "conic"];

/* ------------------------------------------------------------------ */
/* Multi-shadow presets (composed box-shadow strings)                 */
/* ------------------------------------------------------------------ */

export const SHADOW_LAYER_PRESETS: { label: string; layer: ShadowLayer }[] = [
  { label: "sm", layer: { x: 0, y: 1, blur: 2, spread: 0, color: "rgba(0,0,0,0.08)", inset: false } },
  { label: "md", layer: { x: 0, y: 4, blur: 12, spread: 0, color: "rgba(0,0,0,0.12)", inset: false } },
  { label: "lg", layer: { x: 0, y: 12, blur: 32, spread: 0, color: "rgba(0,0,0,0.18)", inset: false } },
  { label: "xl", layer: { x: 0, y: 24, blur: 48, spread: -8, color: "rgba(0,0,0,0.24)", inset: false } },
];

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

export const shadowLayerToCss = (l: ShadowLayer): string =>
  `${l.inset ? "inset " : ""}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`;

export const shadowsToCss = (layers: ShadowLayer[]): string =>
  layers.map(shadowLayerToCss).join(", ");

/** Parse a composed box-shadow string back into editable layers. Best-effort:
 *  falls back to a single default layer when the string isn't recognized. */
export const parseShadowLayers = (value: unknown): ShadowLayer[] => {
  if (typeof value !== "string" || !value.trim() || value === "none") return [];
  // Split on commas that are NOT inside rgba(...) parens.
  const parts = value.match(/(?:[^,(]|\([^)]*\))+/g) ?? [];
  const layers: ShadowLayer[] = [];
  for (const raw of parts) {
    const part = raw.trim();
    const inset = /\binset\b/.test(part);
    const body = part.replace(/\binset\b/, "").trim();
    const colorMatch = body.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|hsla?\([^)]*\)|[a-z]+)$/);
    const color = colorMatch ? colorMatch[0] : "rgba(0,0,0,0.15)";
    const nums = body
      .replace(color, "")
      .trim()
      .split(/\s+/)
      .map((n) => parseFloat(n))
      .filter((n) => !Number.isNaN(n));
    layers.push({
      x: nums[0] ?? 0,
      y: nums[1] ?? 0,
      blur: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      color,
      inset,
    });
  }
  return layers;
};

/* ------------------------------------------------------------------ */
/* Transitions                                                        */
/* ------------------------------------------------------------------ */

export const TRANSITION_PROPERTIES = [
  "all",
  "transform",
  "opacity",
  "box-shadow",
  "background-color",
  "color",
  "border-color",
  "filter",
];
export const TRANSITION_TIMINGS = [
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "linear",
  "cubic-bezier(0.4, 0, 0.2, 1)",
];
