import * as React from "react";
import { icons, type LucideIcon } from "lucide-react";
import { SafeLink, sanitizeText, resolveSurfaceStyles } from "../lib";

/* ---- Icon -------------------------------------------------------- */
/**
 * Renders a single lucide icon by its PascalCase `name` (e.g. "Camera",
 * "ArrowRight"). The name → component lookup is guarded: an unknown/empty name
 * renders a neutral fallback box so the canvas + published page never crash.
 *
 * `color` follows the theme-token convention — it may be a literal color OR a
 * CSS var expression like `hsl(var(--primary))`; it is passed straight through
 * to the SVG `color`/stroke so themed pages recolor automatically. SSR-safe:
 * the lucide icon set is a static import map, no window/document access.
 */
export const Icon = React.forwardRef<
  HTMLSpanElement,
  {
    name?: string;
    size?: number;
    color?: string;
    strokeWidth?: number;
    url?: string;
    label?: string;
    styles?: unknown;
  }
>(({ name = "Sparkles", size = 32, color = "currentColor", strokeWidth = 2, url, label, styles }, ref) => {
  const { wrapper, surface } = resolveSurfaceStyles(styles);
  const resolvedColor = (surface.color as string | undefined) || color;

  const Cmp = resolveIcon(name);
  const innerIcon = Cmp ? (
    <Cmp size={size} color={resolvedColor} strokeWidth={strokeWidth} aria-hidden={label ? undefined : true} />
  ) : (
    // Fallback: an unknown icon name renders a dashed placeholder square.
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "1px dashed #cbd5e1",
        borderRadius: 4,
        boxSizing: "border-box",
      }}
    />
  );

  const content = (
    <span
      className="cms-icon"
      role={label ? "img" : undefined}
      aria-label={label ? sanitizeText(label) : undefined}
      style={{ display: "inline-flex", lineHeight: 0, color: resolvedColor }}
    >
      {innerIcon}
    </span>
  );

  return (
    <span ref={ref} style={{ display: "inline-block", ...wrapper }}>
      {url ? (
        <SafeLink url={url} style={{ display: "inline-flex", color: resolvedColor }}>
          {content}
        </SafeLink>
      ) : (
        content
      )}
    </span>
  );
});
Icon.displayName = "Icon";

/**
 * Look up a lucide component by name. lucide exposes its set as the `icons` map
 * keyed by PascalCase names. We also accept a couple of common alternate forms
 * (kebab-case, lower) so values from older data still resolve. Returns null when
 * unresolved (the block renders its fallback).
 */
const ICONS = icons as Record<string, LucideIcon>;

const toPascal = (s: string): string =>
  s
    .replace(/[-_\s]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toUpperCase());

export const resolveIcon = (name: string | undefined): LucideIcon | null => {
  if (!name) return null;
  if (ICONS[name]) return ICONS[name];
  const pascal = toPascal(name);
  return ICONS[pascal] ?? null;
};

/** Sorted list of every available lucide icon name (used by the picker). */
export const ALL_ICON_NAMES: string[] = Object.keys(icons).sort();
