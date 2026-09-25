import { normalizeColorValue } from "./normalize-color";
import { normalizeLengthValue } from "./normalize-length";
import type { NormalizedLength } from "./types";
import type { NormalizedTypography } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const SUPPORTED_FONT_SIZE_UNITS = new Set(["px", "%", "rem", "em", "vw", "vh"]);
const SIZE_HAS_UNIT_PATTERN = /^-?\d+(?:\.\d+)?(px|%|rem|em|vw|vh)$/i;

const normalizeSizeUnit = (sizeUnitRaw: unknown): NormalizedLength["unit"] => {
  const trimmed = typeof sizeUnitRaw === "string" ? sizeUnitRaw.trim().toLowerCase() : "";
  if (trimmed && SUPPORTED_FONT_SIZE_UNITS.has(trimmed)) {
    return trimmed as NormalizedLength["unit"];
  }
  return "px";
};

const normalizeFontSizeValue = (size: unknown, sizeUnitRaw: unknown): NormalizedLength | undefined => {
  if (size == null) return undefined;
  const sizeUnit = normalizeSizeUnit(sizeUnitRaw);
  if (typeof size === "number" && Number.isFinite(size)) {
    return normalizeLengthValue(`${size}${sizeUnit}`);
  }
  if (typeof size === "string") {
    const trimmed = size.trim();
    if (!trimmed) return undefined;
    if (SIZE_HAS_UNIT_PATTERN.test(trimmed)) return normalizeLengthValue(trimmed);
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return normalizeLengthValue(`${asNumber}${sizeUnit}`);
    return normalizeLengthValue(`${trimmed}${sizeUnit}`);
  }
  return undefined;
};

const fontWeightFromVariant = (variant: unknown): number | string | undefined => {
  if (typeof variant === "number" && Number.isFinite(variant)) return variant;
  if (typeof variant !== "string" || !variant.trim()) return undefined;
  const trimmed = variant.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
};

/** Generic `custom_font` / font field objects (connector-normalized, not HubSpot-named in UDD). */
export const normalizeTypographyFromFontObject = (raw: unknown): NormalizedTypography | undefined => {
  if (!isPlainObject(raw)) return undefined;
  const typography: NormalizedTypography = {};
  if (typeof raw.font === "string" && raw.font.trim()) {
    typography.fontFamily = raw.font.trim();
  } else if (typeof raw.fallback === "string" && raw.fallback.trim()) {
    typography.fontFamily = raw.fallback.trim();
  }
  const fontSize = normalizeFontSizeValue(raw.size, raw.size_unit);
  if (fontSize) typography.fontSize = fontSize;
  const weight = fontWeightFromVariant(raw.variant);
  if (weight != null) typography.fontWeight = weight;
  const color = normalizeColorValue(raw);
  if (color) typography.color = color;
  if (typeof raw.css === "string" && raw.css.trim() && !typography.color) {
    typography.color = normalizeColorValue(raw.css);
  }
  const inlineStyles = raw.styles;
  if (isPlainObject(inlineStyles)) {
    if (inlineStyles.bold === true) typography.bold = true;
    if (inlineStyles.italic === true) typography.italic = true;
    if (inlineStyles.underline === true) typography.underline = true;
  }
  if (Object.keys(typography).length === 0) return undefined;
  return typography;
};

export const mergeTypography = (
  base: NormalizedTypography | undefined,
  overlay: NormalizedTypography | undefined,
): NormalizedTypography | undefined => {
  if (!base && !overlay) return undefined;
  return { ...base, ...overlay };
};
