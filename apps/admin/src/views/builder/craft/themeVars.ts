import type { CSSProperties } from "react";

/**
 * Convert a site's admin theme tokens into the CSS custom properties the SHARED
 * blocks read, so the builder canvas matches the public render (WYSIWYG parity).
 *
 * Two layers are emitted:
 *  1. Every token verbatim as `--<token>` (mirrors the renderer's
 *     `themeTokensToCssVars`, so literal-token color controls resolve correctly).
 *  2. A mapping from the admin editor's friendly token keys (primary, foreground,
 *     fontFamily, …) to the `--ob-*` variables that `@ob-cms/blocks/blocks.css`
 *     consumes (`--ob-brand`, `--ob-ink`, `--ob-font-body`, …). Without this the
 *     canvas would fall back to the blocks.css defaults instead of the site brand.
 *
 * Pure & SSR-safe.
 */
export function themeTokensToCanvasVars(
  tokens: Record<string, unknown> | undefined,
): CSSProperties {
  const style: Record<string, string> = {};
  if (!tokens) return style as CSSProperties;

  const put = (key: string, value: unknown): void => {
    if (value === undefined || value === null || value === "") return;
    style[key] = String(value);
  };

  // 1. Pass through every token as its own CSS var.
  for (const [rawKey, rawVal] of Object.entries(tokens)) {
    const key = rawKey.startsWith("--") ? rawKey : `--${rawKey}`;
    put(key, rawVal);
  }

  // 2. Map friendly editor tokens → the --ob-* vars used by blocks.css.
  const t = tokens as Record<string, unknown>;
  put("--ob-brand", t.primary);
  put("--ob-brand-hover", t.secondary ?? t.accent ?? t.primary);
  put("--ob-ink", t.foreground);
  put("--ob-muted", t.muted);
  put("--ob-surface", t.background);
  put("--ob-font-body", t.fontFamily);
  put("--ob-font-head", t.headingFontFamily ?? t.fontFamily);

  return style as CSSProperties;
}
