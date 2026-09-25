import type { SerializedLayout } from "./layout";

/**
 * Remove `Reusable Block` nodes that reference a deleted reusable-block id from
 * a SerializedLayout tree. Used when a block is soft-deleted so stale references
 * stop 404ing on every page load.
 */
export function scrubReusableBlockReferences(
  layout: SerializedLayout | null | undefined,
  deletedId: string,
): SerializedLayout | null {
  if (!layout?.nodes) return layout ?? null;

  const removeIds = new Set<string>();
  for (const [id, node] of Object.entries(layout.nodes)) {
    const name = node.type?.resolvedName;
    const ref = (node.props as { reusableBlockId?: string } | undefined)?.reusableBlockId;
    if (name === "Reusable Block" && ref === deletedId) {
      removeIds.add(id);
    }
  }

  if (removeIds.size === 0) return layout;

  const nodes = { ...layout.nodes };
  for (const id of removeIds) {
    delete nodes[id];
  }

  for (const [id, node] of Object.entries(nodes)) {
    let next = node;
    if (node.nodes?.length) {
      const filtered = node.nodes.filter((childId) => !removeIds.has(childId));
      if (filtered.length !== node.nodes.length) {
        next = { ...next, nodes: filtered };
      }
    }
    if (node.linkedNodes && Object.keys(node.linkedNodes).length) {
      const linkedNodes = Object.fromEntries(
        Object.entries(node.linkedNodes).filter(([, childId]) => !removeIds.has(childId)),
      );
      if (Object.keys(linkedNodes).length !== Object.keys(node.linkedNodes).length) {
        next = { ...next, linkedNodes };
      }
    }
    if (next !== node) nodes[id] = next;
  }

  let root = layout.root;
  if (removeIds.has(root)) {
    const fallback =
      nodes.ROOT?.nodes?.find((childId) => !removeIds.has(childId)) ??
      Object.keys(nodes).find((id) => !removeIds.has(id) && nodes[id]?.parent === null);
    if (fallback) root = fallback;
  }

  return { ...layout, root, nodes };
}

/** Swap a reusable-block reference id across a layout tree (repair stale refs). */
export function replaceReusableBlockReferences(
  layout: SerializedLayout | null | undefined,
  fromId: string,
  toId: string,
): SerializedLayout | null {
  if (!layout?.nodes || fromId === toId) return layout ?? null;

  let changed = false;
  const nodes = { ...layout.nodes };

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type?.resolvedName !== "Reusable Block") continue;
    const ref = (node.props as { reusableBlockId?: string } | undefined)?.reusableBlockId;
    if (ref !== fromId) continue;
    nodes[id] = {
      ...node,
      props: { ...(node.props as Record<string, unknown>), reusableBlockId: toId },
    };
    changed = true;
  }

  return changed ? { ...layout, nodes } : layout;
}
