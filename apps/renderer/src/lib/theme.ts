import type { CSSProperties } from "react";
import type { ThemeTokens } from "./public-api-types";

/**
 * Convert a site's flat theme tokens into CSS custom properties applied on the
 * page wrapper, so the SHARED blocks (which read `var(--token)`) are themed per
 * tenant. Tokens are emitted as `--<token>`; a token already prefixed with `--`
 * is passed through. Values are stringified; non-finite/empty are skipped.
 */
export function themeTokensToCssVars(tokens: ThemeTokens | undefined): CSSProperties {
  const style: Record<string, string> = {};
  if (!tokens) return style as CSSProperties;
  for (const [rawKey, rawVal] of Object.entries(tokens)) {
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;
    const key = rawKey.startsWith("--") ? rawKey : `--${rawKey}`;
    style[key] = String(rawVal);
  }
  return style as CSSProperties;
}
