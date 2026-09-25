import type { SerializedLayout } from "@ob-cms/block-schema";

/**
 * PageSpeed auto-fix engine (Phase 2). Each fix maps ONE Lighthouse audit id
 * (the `recommendation.id` captured in Phase 1) to a concrete, previewable edit
 * on a page's `SerializedLayout`. Fixes are pure functions over the layout — no
 * DB, no Nest — so they are trivially unit-testable and the same `plan()` powers
 * both "preview" (list the changes) and "apply" (persist the resulting layout).
 *
 * Extending: add a new file under `./fixes/*.fix.ts` and register it in
 * `./registry.ts`. Nothing else needs to change.
 */

/**
 * How a fix is surfaced to the user:
 *  - `automatic`  — safe to apply with no visual trade-off (e.g. lazy-loading).
 *  - `one_click`  — a real content edit the user opts into (e.g. image dims).
 *  - `manual`     — cannot be applied to the page draft here (needs theme/site
 *                   config or human judgement); we only detect + explain.
 */
export type FixCategory = "automatic" | "one_click" | "manual";

/**
 * What "applying" a fix does:
 *  - `layout`         — edit the page draft layout (default; the `plan.layout`
 *                       is persisted via the normal saveDraft flow).
 *  - `media-optimize` — no layout edit; the planned changes name page images
 *                       that should be re-encoded, and the service queues them
 *                       through the existing image-processing pipeline.
 */
export type FixEffect = "layout" | "media-optimize";

/** A single concrete prop change a fix will make to one node. */
export interface FixChange {
  nodeId: string;
  /** The block prop being written (e.g. `loading`, `width`). */
  field: string;
  before: unknown;
  after: unknown;
  /** Human-readable one-liner, e.g. `Set loading="lazy" on Image`. */
  summary: string;
}

/** The result of planning a fix against a layout (pure — nothing persisted). */
export interface FixPlan {
  changes: FixChange[];
  /**
   * The layout with the changes applied (a new object when `changes` is
   * non-empty, otherwise the input layout unchanged). Never mutates the input.
   */
  layout: SerializedLayout;
}

/** A single, self-contained auto-fix module. */
export interface AutoFix {
  /** Canonical Lighthouse audit id this fix addresses (matches `recommendation.id`). */
  ruleId: string;
  /**
   * Additional Lighthouse audit ids this same fix also resolves. The fix is
   * offered when ANY of `[ruleId, ...ruleIds]` is flagged on the page.
   */
  ruleIds?: readonly string[];
  category: FixCategory;
  /** What applying does. Defaults to `"layout"` when omitted. */
  effect?: FixEffect;
  title: string;
  description: string;
  /**
   * Compute the changes + resulting layout WITHOUT persisting. Deterministic
   * and side-effect-free. Manual fixes (and `media-optimize` fixes) return the
   * input `layout` unchanged; their `changes` describe the affected nodes.
   */
  plan(layout: SerializedLayout): FixPlan;
}

/** Every Lighthouse rule id a fix responds to (`ruleId` + any `ruleIds`). */
export const fixRuleIds = (fix: AutoFix): string[] => [fix.ruleId, ...(fix.ruleIds ?? [])];
