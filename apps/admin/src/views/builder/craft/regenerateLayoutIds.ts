import type { SerializedLayout } from "@ob-cms/block-schema";

const freshId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Regenerate every node id in a full-layout preset (keeping the root keyed as
 * "ROOT" so the insert path can read its children), remapping all `parent` /
 * `nodes` / `linkedNodes` references. Fresh ids on every call → dropping the
 * same full-page preset twice never collides with itself or with live nodes.
 */
export const regenerateLayoutIds = (layout: SerializedLayout): SerializedLayout => {
  const idMap = new Map<string, string>();
  for (const id of Object.keys(layout.nodes)) {
    idMap.set(id, id === layout.root ? "ROOT" : freshId());
  }
  const remap = (id: string): string => idMap.get(id) ?? id;

  const nodes: SerializedLayout["nodes"] = {};
  for (const [oldId, node] of Object.entries(layout.nodes)) {
    const src = node as unknown as Record<string, unknown>;
    const linkedNodes: Record<string, string> = {};
    for (const [slot, linkedId] of Object.entries(
      (src.linkedNodes ?? {}) as Record<string, string>,
    )) {
      linkedNodes[slot] = remap(linkedId);
    }
    const parent = src.parent as string | null | undefined;
    nodes[remap(oldId)] = {
      ...(src as SerializedLayout["nodes"][string]),
      parent: parent == null ? null : remap(parent),
      nodes: ((src.nodes ?? []) as string[]).map(remap),
      linkedNodes,
    };
  }
  return { schemaVersion: "2.0", root: "ROOT", nodes };
};
