import { z } from "zod";

/**
 * Data-binding + conditional-visibility schema (node-level) for the page
 * builder. Turns the builder from static-only into dynamic:
 *
 *  - `bindings`: a `Record<propPath, fieldKey>` on a node. When the node is
 *    inside a `RepeaterItemContext` (the renderer's per-item render, or the
 *    editor's sample-item preview) and a prop is bound, the prop's resolved
 *    value becomes `item.data[fieldKey]`. Outside a repeater — or when the field
 *    is missing — the static prop value is used (backward-compatible).
 *
 *  - `visibleIf`: a node-level visibility condition evaluated by the shared
 *    render path. Locale / authenticated / field(within a repeater) / always.
 *    The renderer hides the node; the editor instead shows a "hidden" affordance
 *    so authors can still select+edit it.
 *
 * These live on the serialized node (see `blockNodeSchema`), so they round-trip
 * losslessly editor↔renderer and emit NOTHING for nodes that don't use them.
 */

/** A node's prop→field bindings: `{ [propPath]: collectionFieldKey }`. */
export const bindingsSchema = z.record(z.string()).optional();
export type Bindings = Record<string, string>;

/** Comparison operators for `field`/`locale` visibility conditions. */
export const visibleOpSchema = z.enum(["eq", "neq", "truthy", "falsy"]);
export type VisibleOp = z.infer<typeof visibleOpSchema>;

/**
 * Node-level visibility condition.
 *  - `always`     → always visible (the default / no-op).
 *  - `locale`     → compare the active render locale (`value`, `op` eq/neq).
 *  - `authenticated` → visible when there is a visitor session (documented seam;
 *                     defaults to true until visitor auth is plumbed).
 *  - `field`      → within a repeater, compare `item.data[value-as-field?]`. We
 *                   store the field key in `field` and the compared literal in
 *                   `value`.
 *  - `audience`   → Phase 4 personalization: visible only to visitors who are
 *                   `in` / `not-in` a given audience (`audienceId`). The renderer
 *                   resolves the visitor's audience set (via a first-party cookie
 *                   → server-side, else a client resolve) into `ctx.audiences`.
 */
export const audienceOpSchema = z.enum(["in", "not-in"]);
export type AudienceOp = z.infer<typeof audienceOpSchema>;

export const visibleIfSchema = z
  .object({
    type: z.enum(["always", "locale", "authenticated", "field", "audience"]),
    op: visibleOpSchema.optional(),
    /** The compared literal (locale code, field value to match). */
    value: z.string().optional(),
    /** For `type: "field"`, the collection field key to read from the item. */
    field: z.string().optional(),
    /** For `type: "audience"`, the target audience id. */
    audienceId: z.string().optional(),
    /** For `type: "audience"`, membership test (default `in`). */
    audienceOp: audienceOpSchema.optional(),
  })
  .optional();
export type VisibleIf = NonNullable<z.infer<typeof visibleIfSchema>>;

/**
 * The render-time context a node is resolved against. Pure data — no React — so
 * it can be unit-tested and shared by editor + renderer.
 */
export interface BindingContext {
  /** The current repeater item's data (field-key → value), if inside a repeater. */
  item?: Record<string, unknown> | null;
  /** Active render locale (e.g. "en", "es"). */
  locale?: string;
  /** Whether a visitor session is present (visitor-auth seam). */
  authenticated?: boolean;
  /**
   * The set of audience ids the current visitor belongs to (Phase 4). Resolved
   * server-side (first-party `ob_vid` cookie → `audience_memberships`) or, when
   * only the localStorage id is available, client-side. Absent → treated as the
   * empty set (an `in` condition fails, a `not-in` passes).
   */
  audiences?: string[];
}

/**
 * Resolve a single bound prop. Given the static value, the prop path, the node's
 * bindings map and the current item, returns the item field value when bound +
 * present, else the static value. Pure + SSR-safe.
 */
export const resolveBinding = (
  staticValue: unknown,
  propPath: string,
  bindings: Bindings | undefined,
  item: Record<string, unknown> | null | undefined,
): unknown => {
  if (!bindings || !item) return staticValue;
  const fieldKey = bindings[propPath];
  if (!fieldKey) return staticValue;
  const bound = item[fieldKey];
  // Missing/empty bound value → fall back to the static value (so a partially
  // populated item still shows the authored placeholder).
  if (bound === undefined || bound === null || bound === "") return staticValue;
  return bound;
};

/**
 * Apply every binding on a node to its props, returning a NEW props object with
 * bound props overridden by the current item's field values. Untouched when the
 * node has no bindings or there's no item (backward-compatible identity).
 */
export const applyBindings = (
  props: Record<string, unknown>,
  bindings: Bindings | undefined,
  item: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  if (!bindings || !item || Object.keys(bindings).length === 0) return props;
  const next: Record<string, unknown> = { ...props };
  for (const propPath of Object.keys(bindings)) {
    next[propPath] = resolveBinding(props[propPath], propPath, bindings, item);
  }
  return next;
};

/**
 * Evaluate a node's `visibleIf` against the render context. Returns true (show)
 * when there is no condition, an `always` condition, or the condition matches.
 * Pure + deterministic so it runs identically in the renderer (true hide) and
 * the editor (visual "hidden" affordance).
 */
export const evaluateVisibleIf = (
  visibleIf: VisibleIf | undefined,
  ctx: BindingContext,
): boolean => {
  if (!visibleIf || visibleIf.type === "always") return true;

  const compare = (actual: unknown, op: VisibleOp | undefined, value: string | undefined): boolean => {
    switch (op ?? "eq") {
      case "truthy":
        return Boolean(actual);
      case "falsy":
        return !actual;
      case "neq":
        return String(actual ?? "") !== String(value ?? "");
      case "eq":
      default:
        return String(actual ?? "") === String(value ?? "");
    }
  };

  switch (visibleIf.type) {
    case "locale":
      return compare(ctx.locale, visibleIf.op, visibleIf.value);
    case "authenticated":
      // Seam: until visitor auth is plumbed, `authenticated` defaults to true.
      return ctx.authenticated ?? true;
    case "field": {
      const actual = visibleIf.field ? ctx.item?.[visibleIf.field] : undefined;
      return compare(actual, visibleIf.op, visibleIf.value);
    }
    case "audience": {
      // No target audience configured → treat as always-visible (no-op).
      if (!visibleIf.audienceId) return true;
      const isMember = (ctx.audiences ?? []).includes(visibleIf.audienceId);
      return (visibleIf.audienceOp ?? "in") === "not-in" ? !isMember : isMember;
    }
    default:
      return true;
  }
};
