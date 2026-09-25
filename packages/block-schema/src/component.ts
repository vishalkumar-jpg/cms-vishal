import { z } from "zod";
import type { BlockNode, NodeMap, SerializedLayout } from "./layout";

/**
 * COMPONENTS — reusable blocks upgraded into true design-system components.
 *
 * A component is a reusable block that additionally declares:
 *   - `props`    — typed, editable inputs with defaults (text/richtext/number/
 *                  boolean/color/image/url/select);
 *   - `variants` — optional named prop-presets (a partial override of defaults);
 *   - slots      — nodes within its `layout` flagged `isSlot` + named, marking
 *                  editable regions an instance can fill.
 *
 * The component's `layout` can reference its own prop values via a node-level
 * `componentBinding` (`{ [propPath]: componentPropKey }`) — analogous to the
 * data-binding `bindings`, but sourced from the INSTANCE's merged prop values
 * instead of a repeater item. Resolution is a PURE function (this module) shared
 * by the renderer and the admin preview so editor↔renderer parity holds and it
 * stays SSR-safe / hook-free.
 *
 * Backward-compat: a plain reusable block (no `props`/`variants`/slot nodes /
 * overrides) resolves to its layout UNCHANGED — every existing instance renders
 * byte-identically.
 */

/* ---- prop declarations ------------------------------------------------- */

/** Editable prop value kinds a component may declare. */
export const componentPropTypeSchema = z.enum([
  "text",
  "richtext",
  "number",
  "boolean",
  "color",
  "image",
  "url",
  "select",
]);
export type ComponentPropType = z.infer<typeof componentPropTypeSchema>;

/** A single declared, editable component prop. */
export const componentPropSchema = z.object({
  /** Stable key referenced by `componentBinding`s and instance overrides. */
  key: z.string(),
  /** Human label shown in the instance override panel. */
  label: z.string().optional(),
  type: componentPropTypeSchema.default("text"),
  /** Default value applied when no variant/override supplies one. */
  default: z.unknown().optional(),
  /** Options for `type: "select"`. */
  options: z.array(z.string()).optional(),
});
export type ComponentProp = z.infer<typeof componentPropSchema>;

/** A named preset: a partial map of prop-key → value applied over defaults. */
export const componentVariantSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  values: z.record(z.unknown()).default({}),
});
export type ComponentVariant = z.infer<typeof componentVariantSchema>;

/** A node prop→component-prop-key binding (resolved from instance prop values). */
export const componentBindingSchema = z.record(z.string()).optional();
export type ComponentBinding = Record<string, string>;

/** The full component definition stored alongside a reusable block's layout. */
export const componentDefinitionSchema = z.object({
  props: z.array(componentPropSchema).default([]),
  variants: z.array(componentVariantSchema).default([]),
});
export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;

/** A resolved component as the runtime context returns it (layout + def). */
export interface ResolvedComponent {
  layout: SerializedLayout;
  props?: ComponentProp[];
  variants?: ComponentVariant[];
  /** Optional display name (admin preview / debugging). */
  name?: string;
}

/** The per-instance overrides carried by a `ReusableBlock` instance node. */
export interface ComponentInstanceConfig {
  /** Selected variant name (applied before per-prop overrides). */
  variant?: string;
  /** Per-instance prop overrides (highest precedence). */
  propOverrides?: Record<string, unknown>;
  /** Per-slot replacement content (a SerializedLayout subtree per slot name). */
  slotContent?: Record<string, SerializedLayout>;
}

/* ---- pure resolution --------------------------------------------------- */

/**
 * Merge prop defaults → variant preset → per-instance overrides into the final
 * prop-value map the component layout binds against. Pure. Later sources win.
 */
export const mergeComponentProps = (
  props: ComponentProp[] | undefined,
  variant: string | undefined,
  variants: ComponentVariant[] | undefined,
  overrides: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const p of props ?? []) {
    if (p.default !== undefined) merged[p.key] = p.default;
  }
  if (variant) {
    const v = (variants ?? []).find((x) => x.name === variant);
    if (v) for (const [k, val] of Object.entries(v.values)) merged[k] = val;
  }
  for (const [k, val] of Object.entries(overrides ?? {})) {
    if (val !== undefined) merged[k] = val;
  }
  return merged;
};

/** A node may carry the component authoring fields (see `blockNodeSchema`). */
type ComponentNode = BlockNode & {
  componentBinding?: ComponentBinding;
  isSlot?: boolean;
  slotName?: string;
};

/**
 * Apply a node's `componentBinding`s against the merged instance prop values,
 * returning a NEW props object with bound props overridden. Identity when the
 * node has no binding (backward-compatible). A bound-but-undefined value falls
 * back to the static prop (so a partially configured instance keeps its
 * authored placeholder).
 */
export const applyComponentBindings = (
  props: Record<string, unknown>,
  binding: ComponentBinding | undefined,
  values: Record<string, unknown>,
): Record<string, unknown> => {
  if (!binding || Object.keys(binding).length === 0) return props;
  const next: Record<string, unknown> = { ...props };
  for (const [propPath, propKey] of Object.entries(binding)) {
    const v = values[propKey];
    if (v !== undefined && v !== null && v !== "") next[propPath] = v;
  }
  return next;
};

/** A node id generator that is deterministic per (instance, slot) so SSR is stable. */
const slotChildPrefix = (slotName: string): string => `__slot_${slotName}__`;

/**
 * Resolve a component definition + instance config into a plain, ready-to-render
 * `SerializedLayout`. This is the single shared, PURE resolution used by BOTH
 * the renderer and the admin preview (parity), so it is hook-free and SSR-safe:
 *
 *   1. merge variant + overrides over the prop defaults → `values`;
 *   2. for every node, fold its `componentBinding` into its props using `values`
 *      (and strip the authoring-only flags so the downstream walker is unaware);
 *   3. for every slot node, splice the instance's `slotContent[name]` subtree in
 *      place of the slot's default children (keeping defaults when absent).
 *
 * The returned layout has no component-specific fields, so `RenderLayout` walks
 * it identically to any other layout (no new render-path code needed).
 */
export const resolveComponentInstance = (
  component: ResolvedComponent,
  config: ComponentInstanceConfig | undefined,
): SerializedLayout => {
  const base = component.layout;
  const values = mergeComponentProps(
    component.props,
    config?.variant,
    component.variants,
    config?.propOverrides,
  );

  const nodes: NodeMap = {};

  // Fold componentBindings into each node's props; carry slot flags forward so
  // the slot pass below can find them.
  for (const [id, raw] of Object.entries(base.nodes)) {
    const node = raw as ComponentNode;
    const props = applyComponentBindings(node.props, node.componentBinding, values);
    // Drop authoring-only fields from the emitted node; keep slot markers for the
    // slot pass, then strip them after.
    const { componentBinding, ...rest } = node;
    void componentBinding;
    nodes[id] = { ...rest, props } as BlockNode & {
      isSlot?: boolean;
      slotName?: string;
    };
  }

  /** Collect a node id + all of its transitive descendants (for pruning). */
  const subtreeIds = (rootId: string): string[] => {
    const acc: string[] = [];
    const walk = (cid: string): void => {
      const n = nodes[cid];
      if (!n) return;
      acc.push(cid);
      for (const c of n.nodes ?? []) walk(c);
      for (const c of Object.values(n.linkedNodes ?? {})) walk(c);
    };
    walk(rootId);
    return acc;
  };

  // Slot pass: replace each slot node's children with the instance's content.
  for (const [id, node] of Object.entries(nodes)) {
    const sn = node as BlockNode & { isSlot?: boolean; slotName?: string };
    if (!sn.isSlot || !sn.slotName) continue;
    const content = config?.slotContent?.[sn.slotName];
    if (!content || !content.nodes || !content.nodes[content.root]) continue;

    // Prune the slot's default descendants (they're being replaced) so the map
    // stays clean — the slot node itself is kept.
    const slotNode = nodes[id] as BlockNode;
    for (const childRoot of slotNode.nodes ?? []) {
      for (const orphan of subtreeIds(childRoot)) delete nodes[orphan];
    }

    // Splice the slot content's nodes in under namespaced ids so they never
    // collide with the component layout's own ids (deterministic → SSR-stable).
    const prefix = slotChildPrefix(sn.slotName);
    const remap = (cid: string): string => `${prefix}${cid}`;
    for (const [cid, cnode] of Object.entries(content.nodes)) {
      const c = cnode as BlockNode;
      nodes[remap(cid)] = {
        ...c,
        parent: cid === content.root ? id : c.parent ? remap(c.parent) : id,
        nodes: (c.nodes ?? []).map(remap),
        linkedNodes: Object.fromEntries(
          Object.entries(c.linkedNodes ?? {}).map(([k, v]) => [k, remap(v)]),
        ),
      };
    }
    // Point the slot node at the spliced root, dropping its default children.
    slotNode.nodes = [remap(content.root)];
    slotNode.linkedNodes = {};
  }

  // Strip the authoring-only slot flags so the downstream node is plain.
  for (const node of Object.values(nodes)) {
    const sn = node as { isSlot?: boolean; slotName?: string };
    delete sn.isSlot;
    delete sn.slotName;
  }

  return { schemaVersion: base.schemaVersion, root: base.root, nodes };
};

/**
 * Collect the declared slots (`{ name }`) present in a component layout, in
 * document order. Used by the instance override UI to know which slots exist.
 */
export const collectSlots = (layout: SerializedLayout): { name: string; nodeId: string }[] => {
  const out: { name: string; nodeId: string }[] = [];
  for (const [id, node] of Object.entries(layout.nodes)) {
    const sn = node as ComponentNode;
    if (sn.isSlot && sn.slotName) out.push({ name: sn.slotName, nodeId: id });
  }
  return out;
};
