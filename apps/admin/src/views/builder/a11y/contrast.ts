/**
 * Color parsing + WCAG contrast math (pure, no DOM). Used by the a11y checker to
 * grade text-vs-background contrast. Inputs are CSS color strings already
 * resolved to concrete values (hex / rgb(a) / hsl(a)) — token strings like
 * `hsl(var(--primary))` cannot be graded here and must be resolved upstream
 * (the live-DOM checker reads `getComputedStyle`, which yields `rgb(...)`).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const hexToRgb = (hex: string): Rgb | null => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
};

const hslToRgb = (hDeg: number, s: number, l: number, a: number): Rgb => {
  const sat = clamp(s, 0, 1);
  const lum = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const hp = (((hDeg % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lum - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a,
  };
};

/**
 * Parse a concrete CSS color string into RGBA. Returns null for anything not
 * resolvable without a browser (named colors except a few, `var(...)`, tokens,
 * gradients, `currentColor`, `transparent` handled as null/transparent).
 */
export const parseColor = (input: string | undefined | null): Rgb | null => {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (!v || v === "transparent" || v === "none" || v === "currentcolor") return null;
  if (v.includes("var(") || v.includes("gradient")) return null;
  if (v.startsWith("#")) return hexToRgb(v);

  const rgbM = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgbM) {
    const parts = rgbM[1].split(/[,/\s]+/).filter(Boolean);
    const r = parseFloat(parts[0]);
    const g = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    const a = parts[3] != null ? parseFloat(parts[3]) : 1;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a: Number.isNaN(a) ? 1 : a };
  }

  const hslM = v.match(/^hsla?\(([^)]+)\)$/);
  if (hslM) {
    const parts = hslM[1].split(/[,/\s]+/).filter(Boolean);
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = parts[3] != null ? parseFloat(parts[3]) : 1;
    if ([h, s, l].some((n) => Number.isNaN(n))) return null;
    return hslToRgb(h, s, l, Number.isNaN(a) ? 1 : a);
  }

  const NAMED: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    gray: "#808080",
    grey: "#808080",
  };
  if (NAMED[v]) return hexToRgb(NAMED[v]);
  return null;
};

/** Composite a (possibly translucent) foreground over an opaque background. */
const composite = (fg: Rgb, bg: Rgb): Rgb => {
  if (fg.a >= 1) return fg;
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
};

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of an opaque RGB color. */
export const luminance = (c: Rgb): number =>
  0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

/**
 * WCAG contrast ratio (1–21) between a foreground and background color string.
 * Returns null when either color cannot be resolved to a concrete value.
 */
export const contrastRatio = (
  fgStr: string | null | undefined,
  bgStr: string | null | undefined,
): number | null => {
  const fg = parseColor(fgStr);
  const bg = parseColor(bgStr);
  if (!fg || !bg) return null;
  const opaqueBg = bg.a >= 1 ? bg : composite(bg, { r: 255, g: 255, b: 255, a: 1 });
  const opaqueFg = composite(fg, opaqueBg);
  const l1 = luminance(opaqueFg);
  const l2 = luminance(opaqueBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

export type WcagGrade = "AAA" | "AA" | "AA-large" | "fail";

/** Grade a contrast ratio for the given text size (px) and weight. */
export const gradeContrast = (
  ratio: number,
  fontSizePx: number,
  bold: boolean,
): WcagGrade => {
  const large = fontSizePx >= 24 || (bold && fontSizePx >= 18.66);
  if (large) {
    if (ratio >= 4.5) return "AAA";
    if (ratio >= 3) return "AA-large";
    return "fail";
  }
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return "fail";
};
