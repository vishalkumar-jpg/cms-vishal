import {
  CURRENT_SCHEMA_VERSION,
  migrate,
  repairLayout,
  type SerializedLayout,
  type NodeMap,
} from "@ob-cms/block-schema";

/**
 * Bridges Craft.js's serialized node map and our `SerializedLayout`.
 *
 * Craft's `query.serialize()` returns a JSON string of `Record<nodeId, node>`,
 * where each node already has the `{ type: { resolvedName }, props, isCanvas,
 * hidden, nodes, linkedNodes, parent, displayName, custom }` shape our
 * `NodeMap` expects. We just wrap it with `{ schemaVersion, root, nodes }`.
 *
 * Craft's root node id is always "ROOT".
 */
const CRAFT_ROOT = "ROOT";

/** Parse Craft JSON and hoist editor-only fields from `custom` before migrate/repair. */
export const parseCraftNodes = (craftJson: string): NodeMap => {
  let nodes: NodeMap;
  try {
    nodes = JSON.parse(craftJson) as NodeMap;
  } catch {
    nodes = {} as NodeMap;
  }
  // Data-binding: the editor stores a node's `bindings`/`visibleIf` inside Craft
  // `custom` (the only arbitrary field Craft serializes). Hoist them to
  // top-level so the renderer (which reads `node.bindings`/`node.visibleIf`) and
  // the schema see them. Leaves the copies in `custom` for editor round-trip.
  for (const node of Object.values(nodes)) {
    const custom = (
      node as {
        custom?: {
          bindings?: unknown;
          visibleIf?: unknown;
          experiment?: unknown;
          componentBinding?: unknown;
          isSlot?: unknown;
          slotName?: unknown;
        };
      }
    ).custom;
    if (custom?.bindings) (node as { bindings?: unknown }).bindings = custom.bindings;
    if (custom?.visibleIf) (node as { visibleIf?: unknown }).visibleIf = custom.visibleIf;
    // A/B (Phase 4): the Experiment node's variant↔key mapping + experiment id.
    if (custom?.experiment) (node as { experiment?: unknown }).experiment = custom.experiment;
    // COMPONENTS: hoist the per-node component-authoring fields the same way.
    if (custom?.componentBinding)
      (node as { componentBinding?: unknown }).componentBinding = custom.componentBinding;
    if (custom?.isSlot) (node as { isSlot?: unknown }).isSlot = custom.isSlot;
    if (custom?.slotName) (node as { slotName?: unknown }).slotName = custom.slotName;
    // GUARDRAILS: lock/constraints live entirely in `node.custom` (preserved by
    // the schema's `custom: z.record(z.unknown())`), so they round-trip natively
    // without a top-level hoist — see ../guardrails/useGuardrails.ts.
  }

  return nodes;
};

/** Craft serialized JSON string -> our SerializedLayout (migrated + repaired). */
export const craftToLayout = (craftJson: string): SerializedLayout => {
  const nodes = parseCraftNodes(craftJson);
  const layout: SerializedLayout = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: CRAFT_ROOT,
    nodes,
  };
  // Run through migrate/repair so the persisted shape is always valid.
  return migrate(layout);
};

/**
 * Our SerializedLayout -> the node-map object Craft's `actions.deserialize()`
 * accepts. Craft expects the root keyed as "ROOT"; if a saved layout uses a
 * different root id, remap it.
 */
export const layoutToCraft = (layout: SerializedLayout): NodeMap => {
  const repaired = repairLayout(migrate(layout));
  // Mirror top-level `bindings`/`visibleIf` back into `custom` so the editor
  // (which reads them from Craft `custom`) shows existing bindings/conditions.
  for (const node of Object.values(repaired.nodes)) {
    const n = node as {
      custom?: Record<string, unknown>;
      bindings?: unknown;
      visibleIf?: unknown;
      experiment?: unknown;
      componentBinding?: unknown;
      isSlot?: unknown;
      slotName?: unknown;
    };
    // GUARDRAILS already persist inside `custom` (preserved by the schema), so no
    // top-level mirror is needed here — they survive the round-trip natively.
    if (n.bindings || n.visibleIf || n.experiment || n.componentBinding || n.isSlot) {
      n.custom = {
        ...(n.custom ?? {}),
        ...(n.bindings ? { bindings: n.bindings } : {}),
        ...(n.visibleIf ? { visibleIf: n.visibleIf } : {}),
        ...(n.experiment ? { experiment: n.experiment } : {}),
        ...(n.componentBinding ? { componentBinding: n.componentBinding } : {}),
        ...(n.isSlot ? { isSlot: n.isSlot } : {}),
        ...(n.slotName ? { slotName: n.slotName } : {}),
      };
    }
  }
  if (repaired.root === CRAFT_ROOT) return repaired.nodes;

  // Remap the root id to "ROOT" so Craft can deserialize it.
  const nodes: NodeMap = {};
  for (const [id, node] of Object.entries(repaired.nodes)) {
    const newId = id === repaired.root ? CRAFT_ROOT : id;
    const remapped = { ...node };
    if (remapped.parent === repaired.root) remapped.parent = CRAFT_ROOT;
    if (remapped.nodes) {
      remapped.nodes = remapped.nodes.map((c) => (c === repaired.root ? CRAFT_ROOT : c));
    }
    if (remapped.linkedNodes) {
      remapped.linkedNodes = Object.fromEntries(
        Object.entries(remapped.linkedNodes).map(([k, v]) => [
          k,
          v === repaired.root ? CRAFT_ROOT : v,
        ]),
      );
    }
    nodes[newId] = remapped;
  }
  return nodes;
};
