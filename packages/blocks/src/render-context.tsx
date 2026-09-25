/**
 * RenderEnv — the ambient render environment threaded (as PLAIN DATA, not React
 * context, so the walker stays RSC-safe) through `renderNode`/`RenderLayout`:
 *
 *  - `locale`: the active render locale (drives `visibleIf: locale`).
 *  - `authenticated`: visitor-session seam (drives `visibleIf: authenticated`).
 *  - `editor`: true on the builder canvas — nodes hidden by `visibleIf` are NOT
 *    removed but kept so the canvas can paint a "hidden" affordance (authors can
 *    still select + edit them).
 *
 * Provided by the renderer (per-request locale) and the editor (active preview
 * locale). Absent in raw SSR → sensible defaults (visible).
 *
 * This module is type-only (no React) so it can be imported by the RSC render
 * path without pulling a `"use client"` boundary.
 */
export interface RenderEnv {
  locale?: string;
  authenticated?: boolean;
  editor?: boolean;
  /**
   * Phase 4 personalization: the audience ids the current visitor belongs to,
   * resolved server-side (first-party `ob_vid` cookie → `audience_memberships`)
   * or client-side. Drives `visibleIf: audience`. Absent → empty set.
   */
  audiences?: string[];
  /**
   * Phase 4 A/B testing: the current visitor's first-party id (`ob_vid`), used by
   * an `Experiment` block to deterministically + stickily pick a variant. Absent
   * on the server (localStorage-only) → the Experiment block resolves it after
   * mount from `localStorage["ob_vid"]`.
   */
  visitorId?: string;
  /**
   * Phase 4 A/B testing: pre-resolved variant assignments keyed by experiment id
   * (`{ [experimentId]: variantKey }`), when assignment is computed server-side.
   * Absent → the Experiment block assigns client-side from `visitorId`.
   */
  variants?: Record<string, string>;
}
