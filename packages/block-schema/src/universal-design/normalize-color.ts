import { normalizeHexColorInput, sanitizeColorCSSValue } from "../color-value";
import { MAX_COLOR_OPACITY } from "./types";
import type { NormalizedColor } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_PATTERN = /^rgba?\(/i;
const RGB_COMPONENT = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)%?";
const RGB_COMPONENTS_PATTERN = new RegExp(
  `^rgba?\\(\\s*(${RGB_COMPONENT})\\s*,\\s*(${RGB_COMPONENT})\\s*,\\s*(${RGB_COMPONENT})(?:\\s*,\\s*(${RGB_COMPONENT}))?\\s*\\)$`,
  "i",
);
const RGB_SPACE_COMPONENTS_PATTERN = new RegExp(
  `^rgba?\\(\\s*(${RGB_COMPONENT})\\s+(${RGB_COMPONENT})\\s+(${RGB_COMPONENT})(?:\\s*\\/\\s*(${RGB_COMPONENT}))?\\s*\\)$`,
  "i",
);

const HEX_RGB_SHORT_DIGIT_COUNT = 3;
const HEX_RGBA_SHORT_DIGIT_COUNT = 4;
const HEX_RGB_DIGIT_COUNT = 6;
const HEX_RGBA_DIGIT_COUNT = 8;

const expandHexToSixDigitRgb = (hexDigits: string): string | undefined => {
  switch (hexDigits.length) {
    case HEX_RGB_SHORT_DIGIT_COUNT:
      return hexDigits.split("").map((c) => c + c).join("");
    case HEX_RGBA_SHORT_DIGIT_COUNT:
      return hexDigits
        .slice(0, HEX_RGB_SHORT_DIGIT_COUNT)
        .split("")
        .map((c) => c + c)
        .join("");
    case HEX_RGB_DIGIT_COUNT:
      return hexDigits;
    case HEX_RGBA_DIGIT_COUNT:
      return hexDigits.slice(0, HEX_RGB_DIGIT_COUNT);
    default:
      return undefined;
  }
};

const parseAlphaComponent = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? percent / MAX_COLOR_OPACITY : undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
};

const matchRgbChannels = (
  value: string,
): { r: string; g: string; b: string; alpha?: string } | undefined => {
  const commaMatch = value.match(RGB_COMPONENTS_PATTERN);
  if (commaMatch) {
    return { r: commaMatch[1]!, g: commaMatch[2]!, b: commaMatch[3]!, alpha: commaMatch[4] };
  }
  const spaceMatch = value.match(RGB_SPACE_COMPONENTS_PATTERN);
  if (spaceMatch) {
    return { r: spaceMatch[1]!, g: spaceMatch[2]!, b: spaceMatch[3]!, alpha: spaceMatch[4] };
  }
  return undefined;
};

const clampOpacity = (opacity: number): number =>
  Math.min(MAX_COLOR_OPACITY, Math.max(0, opacity));

const hexFromSanitized = (sanitized: string): string | undefined => {
  const normalized = normalizeHexColorInput(sanitized);
  return HEX_COLOR_PATTERN.test(normalized) ? normalized.toLowerCase() : undefined;
};

const normalizeStringColor = (raw: string): NormalizedColor | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const sanitized = sanitizeColorCSSValue(trimmed) ?? trimmed;
  const hex = hexFromSanitized(sanitized);
  if (hex) return { hex, css: trimmed };
  if (RGB_COLOR_PATTERN.test(sanitized)) return { rgb: sanitized, css: trimmed };
  return { css: trimmed };
};

/** HubSpot `{ color, opacity }` and bare strings / css snippets. */
export const normalizeColorValue = (raw: unknown): NormalizedColor | undefined => {
  if (raw == null) return undefined;
  if (typeof raw === "string") return normalizeStringColor(raw);
  if (!isPlainObject(raw)) return undefined;

  const colorField = raw.color;
  const opacityField = raw.opacity;
  let hex: string | undefined;
  let rgb: string | undefined;
  let css: string | undefined;

  if (typeof raw.css === "string" && raw.css.trim()) {
    css = raw.css.trim();
    const parsed = normalizeStringColor(css);
    if (parsed?.hex) hex = parsed.hex;
    if (parsed?.rgb) rgb = parsed.rgb;
    if (!parsed?.hex && !parsed?.rgb) css = parsed?.css ?? css;
  }
  if (typeof colorField === "string" && colorField.trim()) {
    const parsed = normalizeStringColor(colorField.trim());
    if (parsed?.hex) hex = parsed.hex;
    if (parsed?.rgb) rgb = parsed.rgb;
    if (!hex && !rgb) css = css ?? parsed?.css ?? colorField.trim();
    else if (!css) css = colorField.trim();
  }
  const opacity =
    typeof opacityField === "number" && Number.isFinite(opacityField)
      ? clampOpacity(opacityField)
      : undefined;
  if (!hex && !rgb && !css && opacity == null) return undefined;
  return { hex, rgb, css, opacity };
};

export const colorToCssString = (color: NormalizedColor | undefined): string | undefined => {
  if (!color) return undefined;
  if (color.hex && HEX_COLOR_PATTERN.test(color.hex)) {
    if (color.opacity != null && color.opacity < MAX_COLOR_OPACITY) {
      const expand = expandHexToSixDigitRgb(color.hex.replace("#", ""));
      if (!expand) return undefined;
      const r = parseInt(expand.slice(0, 2), 16);
      const g = parseInt(expand.slice(2, 4), 16);
      const b = parseInt(expand.slice(4, 6), 16);
      const a = color.opacity / MAX_COLOR_OPACITY;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return color.hex;
  }
  if (color.rgb && RGB_COLOR_PATTERN.test(color.rgb)) {
    const channels = matchRgbChannels(color.rgb);
    if (!channels) return undefined;
    if (color.opacity != null) {
      return `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${color.opacity / MAX_COLOR_OPACITY})`;
    }
    if (channels.alpha != null) {
      const alpha = parseAlphaComponent(channels.alpha);
      if (alpha == null) return undefined;
      return `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${alpha})`;
    }
    return `rgb(${channels.r}, ${channels.g}, ${channels.b})`;
  }
  return undefined;
};

/** Values safe for StyleModel color fields (never raw declaration snippets). */
export const safeColorForStyleModel = (color: NormalizedColor | undefined): string | undefined => {
  if (!color) return undefined;
  return colorToCssString(color);
};
