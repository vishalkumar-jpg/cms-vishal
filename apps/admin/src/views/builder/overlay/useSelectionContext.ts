import { useEditor } from "@craftjs/core";

/** Resolved DOM + identity for the primary selected node and its neighbors. */
export interface SelectionContext {
  id: string | null;
  dom: HTMLElement | null;
  parentId: string | null;
  parentDom: HTMLElement | null;
  /** Sibling DOM elements (excluding the selection itself), for snapping. */
  siblingDoms: HTMLElement[];
  isRoot: boolean;
  styles: Record<string, unknown>;
  displayName: string;
}

/**
 * Reads everything the overlay needs about the current single selection from the
 * Craft store in ONE subscription: the node's real DOM (the same `node.dom` the
 * inline toolbar uses), its parent's DOM (the snapping/positioning frame) and its
 * siblings' DOMs (snap targets + distance badges). Returns null-ish when there
 * isn't exactly one selection (resize/spacing handles only show for single select).
 */
export const useSelectionContext = (): SelectionContext => {
  return useEditor((state, query) => {
    const ids = [...state.events.selected];
    const id = ids.length === 1 ? ids[0] : null;
    if (!id || !state.nodes[id]) {
      return {
        id: null,
        dom: null,
        parentId: null,
        parentDom: null,
        siblingDoms: [],
        isRoot: false,
        styles: {},
        displayName: "",
      };
    }
    const node = state.nodes[id];
    const parentId = node.data.parent ?? null;
    const parentNode = parentId ? state.nodes[parentId] : undefined;
    const siblingIds = parentNode ? parentNode.data.nodes.filter((s) => s !== id) : [];
    const siblingDoms = siblingIds
      .map((sid) => state.nodes[sid]?.dom)
      .filter((d): d is HTMLElement => !!d);

    let isRoot = false;
    try {
      isRoot = !query.node(id).isDeletable();
    } catch {
      isRoot = true;
    }

    return {
      id,
      dom: node.dom ?? null,
      parentId,
      parentDom: parentNode?.dom ?? null,
      siblingDoms,
      isRoot,
      styles: (node.data.props["styles"] ?? {}) as Record<string, unknown>,
      displayName: node.data.displayName ?? node.data.name ?? "",
    };
  });
};
