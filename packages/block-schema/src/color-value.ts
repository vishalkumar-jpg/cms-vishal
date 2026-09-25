/**
 * Normalize author input (hex, rgb, hsl, theme tokens) and strip accidental CSS
 * declarations pasted from DevTools (e.g. `background: rgba(...);`).
 */
export function sanitizeColorCSSValue(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  let v = String(raw).trim();
  if (!v) return undefined;

  v = v.replace(/^(background-color|background|color|border-color)\s*:\s*/i, "").trim();
  v = v.replace(/;+$/g, "").trim();

  if (v.includes(";")) {
    const first = v
      .split(";")
      .map((part) => part.trim())
      .find(Boolean);
    if (!first) return undefined;
    v = first.replace(/^(background-color|background|color|border-color)\s*:\s*/i, "").trim();
  }

  return v || undefined;
}

/** Expand 3-digit hex and auto-prefix `#` for bare hex digits. */
export function normalizeHexColorInput(raw: string): string {
  const v = sanitizeColorCSSValue(raw) ?? "";
  if (!v) return "";
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(v)) {
    const [r, g, b] = v.toLowerCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return v;
}
