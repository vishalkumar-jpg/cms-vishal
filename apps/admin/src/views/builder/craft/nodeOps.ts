import * as React from "react";
import type { useEditor } from "@craftjs/core";
import { Element } from "@craftjs/core";
import { blockRegistry } from "@ob-cms/blocks";
import { resolver } from "./resolver";
import {
  CURRENT_SCHEMA_VERSION,
  migrate,
  unwrapPassthroughFragment,
  type SerializedLayout,
} from "@ob-cms/block-schema";

/** Canvas wrappers supported by wrap / unwrap. */
export const WRAP_TYPES = ["Section", "Container", "Grid"] as const;
export type WrapType = (typeof WRAP_TYPES)[number];

export const isWrapType = (name: string | undefined): name is WrapType =>
  !!name && (WRAP_TYPES as readonly string[]).includes(name);

/**
 * Node operations built on Craft's query/actions. `toNodeTree()` clones a
 * subtree; `addNodeTree()` inserts it (assigning fresh ids). Used by duplicate,
 * copy, and paste.
 */
type EditorActions = ReturnType<typeof useEditor>["actions"];
type EditorQuery = ReturnType<typeof useEditor>["query"];

/** Index of a node within its parent's child list (-1 if no parent). */
export const indexInParent = (query: EditorQuery, nodeId: string): number => {
  const parent = query.node(nodeId).get().data.parent;
  if (!parent) return -1;
  return query.node(parent).get().data.nodes.indexOf(nodeId);
};

/** Whether a node can be reordered up (down) within its parent. */
export const canMoveUp = (query: EditorQuery, nodeId: string): boolean =>
  indexInParent(query, nodeId) > 0;

export const canMoveDown = (query: EditorQuery, nodeId: string): boolean => {
  const parent = query.node(nodeId).get().data.parent;
  if (!parent) return false;
  const siblings = query.node(parent).get().data.nodes;
  const idx = siblings.indexOf(nodeId);
  return idx >= 0 && idx < siblings.length - 1;
};

/** Reorder a node within its parent by `delta` (+1 down, -1 up). */
export const moveNode = (
  query: EditorQuery,
  actions: EditorActions,
  nodeId: string,
  delta: number,
): void => {
  const parent = query.node(nodeId).get().data.parent;
  if (!parent) return;
  const siblings = query.node(parent).get().data.nodes;
  const idx = siblings.indexOf(nodeId);
  if (idx < 0) return;
  const target = idx + delta;
  if (target < 0 || target >= siblings.length) return;
  // Craft's move index is computed against the list WITH the node still present,
  // so moving down needs +1 to land past the displaced sibling.
  actions.move(nodeId, parent, delta > 0 ? target + 1 : target);
};

/** Generate a fresh, collision-free node id. */
const freshId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CraftNodeTree = { rootNodeId: string; nodes: Record<string, any> };

/**
 * Clone a Craft NodeTree, assigning a BRAND-NEW id to every node and remapping
 * all `parent` / `nodes` / `linkedNodes` references to the new ids.
 *
 * This is essential because Craft's `addNodeTree` inserts nodes into the store
 * keyed by their EXISTING ids (it does NOT regenerate them). Inserting a tree
 * that reuses ids already live in the document creates duplicate-id entries: the
 * same node ends up referenced by two parents. Deleting one instance then leaves
 * the other parent pointing at a removed id, and Craft crashes on the next
 * render with "Cannot read properties of undefined (reading 'children')".
 *
 * We also give each clone its own shallow `props` copy so Craft's internal
 * `delete props.children` (done for canvas nodes on insert) can't mutate the
 * source node's props.
 */
export const cloneNodeTree = (
  query: EditorQuery,
  tree: CraftNodeTree,
): { rootNodeId: string; nodes: Record<string, ReturnType<typeof buildNode>> } => {
  const idMap = new Map<string, string>();
  for (const oldId of Object.keys(tree.nodes)) idMap.set(oldId, freshId());
  const remap = (id: string | null): string | null =>
    id == null ? id : (idMap.get(id) ?? id);

  const nodes: Record<string, ReturnType<typeof buildNode>> = {};
  for (const [oldId, node] of Object.entries(tree.nodes)) {
    const newId = idMap.get(oldId) as string;
    const data = node.data ?? {};
    const linkedNodes: Record<string, string> = {};
    for (const [slot, linkedId] of Object.entries(
      (data.linkedNodes ?? {}) as Record<string, string>,
    )) {
      linkedNodes[slot] = remap(linkedId) as string;
    }
    const freshData = {
      ...data,
      props: { ...(data.props ?? {}) },
      custom: data.custom ? { ...data.custom } : data.custom,
      parent: remap(data.parent ?? null),
      nodes: ((data.nodes ?? []) as string[]).map((c) => remap(c) as string),
      linkedNodes,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes[newId] = query.parseFreshNode({ id: newId, data: freshData as any }).toNode();
  }
  return { rootNodeId: idMap.get(tree.rootNodeId) as string, nodes };
};

/**
 * Duplicate a node as a sibling inserted directly AFTER the original (so the
 * copy appears next to it, Webflow-style), and return the new root id. Falls
 * back to appending when no parent (shouldn't happen for non-ROOT nodes).
 */
export const duplicateNode = (
  query: EditorQuery,
  actions: EditorActions,
  nodeId: string,
): string | null => {
  const node = query.node(nodeId).get();
  const parent = node.data.parent;
  if (!parent) return null;
  // Fresh ids so the duplicate is a distinct subtree (no id collision).
  const tree = cloneNodeTree(query, query.node(nodeId).toNodeTree());
  const idx = query.node(parent).get().data.nodes.indexOf(nodeId);
  actions.addNodeTree(tree, parent, idx >= 0 ? idx + 1 : undefined);
  return tree.rootNodeId;
};

/** Serialize a subtree to a JSON string for the clipboard. */
export const serializeSubtree = (query: EditorQuery, nodeId: string): string => {
  const tree = query.node(nodeId).toNodeTree();
  const nodes: Record<string, unknown> = {};
  for (const id of Object.keys(tree.nodes)) {
    nodes[id] = query.node(id).toSerializedNode();
  }
  return JSON.stringify({ rootNodeId: tree.rootNodeId, nodes });
};

/**
 * Paste a clipboard subtree. When `afterNodeId` is given the copy is inserted as
 * a sibling right after it (inside that node's parent); otherwise it's appended
 * to `targetParentId`. Returns the new root id (or null on parse failure).
 */
export const pasteSubtree = (
  query: EditorQuery,
  actions: EditorActions,
  clipboard: string,
  targetParentId: string,
  afterNodeId?: string,
): string | null => {
  let parsed: { rootNodeId: string; nodes: Record<string, unknown> };
  try {
    parsed = JSON.parse(clipboard) as { rootNodeId: string; nodes: Record<string, unknown> };
  } catch {
    return null;
  }
  // Rebuild the clipboard nodes, then clone with FRESH ids. Reusing the
  // serialized (original) ids would collide with the source nodes still in the
  // document and corrupt the tree on the next delete.
  const rebuilt = Object.entries(parsed.nodes).reduce<Record<string, ReturnType<typeof buildNode>>>(
    (acc, [id, sn]) => {
      acc[id] = buildNode(query, id, sn);
      return acc;
    },
    {},
  );
  const tree = cloneNodeTree(query, { rootNodeId: parsed.rootNodeId, nodes: rebuilt });
  let parent = targetParentId;
  let index: number | undefined;
  if (afterNodeId && query.node(afterNodeId).get().data.parent) {
    parent = query.node(afterNodeId).get().data.parent as string;
    const idx = query.node(parent).get().data.nodes.indexOf(afterNodeId);
    index = idx >= 0 ? idx + 1 : undefined;
  }
  actions.addNodeTree(tree, parent, index);
  return tree.rootNodeId;
};

/**
 * Serialize a node subtree into a self-contained `SerializedLayout` whose root
 * IS the given node (REUSE-BLOCKS). The selected node's `parent` is nulled so
 * the fragment stands alone. Migrated/repaired so the persisted shape is valid.
 * Used by "Save as reusable block".
 */
const extractSubtreeLayout = (query: EditorQuery, nodeId: string): SerializedLayout => {
  const tree = query.node(nodeId).toNodeTree();
  const nodes: Record<string, unknown> = {};
  for (const id of Object.keys(tree.nodes)) {
    const sn = query.node(id).toSerializedNode() as Record<string, unknown>;
    // Detach the root so the fragment is self-contained.
    nodes[id] = id === tree.rootNodeId ? { ...sn, parent: null } : sn;
  }
  return migrate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: tree.rootNodeId,
    nodes: nodes as SerializedLayout["nodes"],
  });
};

export const subtreeToLayout = (query: EditorQuery, nodeId: string): SerializedLayout =>
  unwrapPassthroughFragment(extractSubtreeLayout(query, nodeId));

/**
 * Wrap a detached subtree fragment under a synthetic canvas ROOT so template
 * insertion (`insertLayoutChildrenAtRoot`) inserts the selected block itself,
 * not only its descendants.
 */
export const wrapFragmentUnderTemplateRoot = (fragment: SerializedLayout): SerializedLayout => {
  const childId = fragment.root;
  const childNode = fragment.nodes[childId];
  if (!childNode) {
    throw new Error("Cannot wrap an empty template fragment");
  }

  const nodes = { ...fragment.nodes } as SerializedLayout["nodes"];
  nodes[childId] = { ...childNode, parent: "ROOT" };
  nodes.ROOT = {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: {},
    displayName: "Section",
    custom: {},
    parent: null,
    hidden: false,
    nodes: [childId],
    linkedNodes: {},
  };

  return {
    schemaVersion: fragment.schemaVersion,
    root: "ROOT",
    nodes,
  };
};

/** Serialize a single selected node as a section template (ROOT → selection). */
export const selectionToSectionTemplateLayout = (
  query: EditorQuery,
  nodeId: string,
): SerializedLayout => wrapFragmentUnderTemplateRoot(extractSubtreeLayout(query, nodeId));

/** Index under canvas ROOT to insert after the selected top-level block, else undefined (append). */
export const resolveRootInsertIndex = (query: EditorQuery): number | undefined => {
  try {
    const selected = query.getEvent("selected").all();
    const selId = selected[selected.length - 1];
    if (!selId || selId === "ROOT") return undefined;

    let cur = selId;
    let parent = query.node(cur).get().data.parent;
    while (parent && parent !== "ROOT") {
      cur = parent;
      parent = query.node(cur).get().data.parent;
    }
    if (parent === "ROOT") {
      const siblings = query.node("ROOT").get().data.nodes;
      const at = siblings.indexOf(cur);
      if (at >= 0) return at + 1;
    }
  } catch {
    /* append */
  }
  return undefined;
};

/**
 * Insert each top-level child from a serialized layout map under canvas ROOT.
 * When `startIndex` is omitted, inserts after the current selection's top-level
 * ancestor when possible.
 */
export const insertLayoutChildrenAtRoot = (
  query: EditorQuery,
  actions: EditorActions,
  serializedNodes: Record<string, unknown>,
  startIndex?: number,
): void => {
  const root = serializedNodes["ROOT"] as { nodes?: string[] } | undefined;
  const childIds = root?.nodes ?? [];
  let index = startIndex ?? resolveRootInsertIndex(query);

  for (const childId of childIds) {
    try {
      const tree = buildTreeFromSerializedMap(query, serializedNodes, childId);
      const fresh = cloneNodeTree(query, tree);
      actions.addNodeTree(fresh, "ROOT", index);
      if (index != null) index += 1;
    } catch {
      /* skip invalid child */
    }
  }
};

/** Merge child node trees under a wrapper root (Section drag-insert / wrap). */
const attachTreesToWrapper = (
  query: EditorQuery,
  wrapper: CraftNodeTree,
  childTrees: CraftNodeTree[],
): CraftNodeTree => {
  const merged: Record<string, ReturnType<typeof buildNode>> = { ...wrapper.nodes };
  const childRootIds: string[] = [];

  for (const tree of childTrees) {
    const rid = tree.rootNodeId;
    childRootIds.push(rid);
    for (const [id, node] of Object.entries(tree.nodes)) {
      if (id === rid) {
        const data = node.data ?? {};
        merged[id] = query
          .parseFreshNode({
            id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { ...data, parent: wrapper.rootNodeId } as any,
          })
          .toNode();
      } else {
        merged[id] = node;
      }
    }
  }

  const wId = wrapper.rootNodeId;
  const wData = merged[wId].data ?? {};
  merged[wId] = query
    .parseFreshNode({
      id: wId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...wData, nodes: childRootIds } as any,
    })
    .toNode();

  return { rootNodeId: wId, nodes: merged };
};

/** Wrap a single node tree in a Section so ROOT-level inserts are full-width sections. */
export const wrapNodeTreeInSection = (
  query: EditorQuery,
  tree: CraftNodeTree,
): CraftNodeTree => {
  const wrapper = buildWrapperTree(query, "Section");
  return attachTreesToWrapper(query, wrapper, [cloneNodeTree(query, tree)]);
};

/** Merge multiple node trees under a Section wrapper for palette drag-insert. */
export const mergeNodeTreesForDrag = (
  query: EditorQuery,
  trees: CraftNodeTree[],
): CraftNodeTree | null => {
  if (trees.length === 0) return null;
  if (trees.length === 1) return trees[0];

  const wrapper = buildWrapperTree(query, "Section");
  return attachTreesToWrapper(query, wrapper, trees);
};

/**
 * Build a drag-insertable NodeTree from a serialized layout (all top-level ROOT
 * children). Multiple children are wrapped in a Section so the whole template
 * drops as one unit at the hover position.
 */
export const buildLayoutDragTree = (
  query: EditorQuery,
  serializedNodes: Record<string, unknown>,
): CraftNodeTree | null => {
  const root = serializedNodes["ROOT"] as { nodes?: string[] } | undefined;
  const childIds = root?.nodes ?? [];
  if (childIds.length === 0) return null;

  const trees: CraftNodeTree[] = [];
  for (const childId of childIds) {
    try {
      const tree = buildTreeFromSerializedMap(query, serializedNodes, childId);
      trees.push(cloneNodeTree(query, tree));
    } catch {
      /* skip invalid child */
    }
  }
  if (trees.length === 0) return null;

  return mergeNodeTreesForDrag(query, trees);
};

const buildNode = (query: EditorQuery, id: string, serialized: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query.parseSerializedNode(serialized as any).toNode((n) => {
    n.id = id;
  });

/**
 * Build a Craft NodeTree (rooted at `rootId`) from a serialized node map by
 * collecting the root's descendants (children + linkedNodes). Used to insert a
 * saved template subtree via `addNodeTree`.
 */
export const buildTreeFromSerializedMap = (
  query: EditorQuery,
  serializedNodes: Record<string, unknown>,
  rootId: string,
): { rootNodeId: string; nodes: Record<string, ReturnType<typeof buildNode>> } => {
  const nodes: Record<string, ReturnType<typeof buildNode>> = {};
  const visit = (id: string): void => {
    const sn = serializedNodes[id] as
      | { nodes?: string[]; linkedNodes?: Record<string, string> }
      | undefined;
    if (!sn || nodes[id]) return;
    nodes[id] = buildNode(query, id, sn);
    for (const childId of sn.nodes ?? []) visit(childId);
    for (const linkedId of Object.values(sn.linkedNodes ?? {})) visit(linkedId);
  };
  visit(rootId);
  return { rootNodeId: rootId, nodes };
};

/** Read a node's Craft `type.resolvedName`. */
export const resolvedNameOf = (query: EditorQuery, nodeId: string): string | undefined => {
  try {
    const sn = query.node(nodeId).toSerializedNode() as {
      type?: { resolvedName?: string } | string;
    };
    return typeof sn.type === "string" ? sn.type : sn.type?.resolvedName;
  } catch {
    return undefined;
  }
};

/** Build a single-node wrapper tree (Section / Container / Grid). */
export const buildWrapperTree = (query: EditorQuery, wrapperType: WrapType): CraftNodeTree => {
  const entry = blockRegistry[wrapperType];
  const Comp = resolver[wrapperType as keyof typeof resolver];
  if (!Comp) {
    throw new Error(`Unknown wrapper block: ${wrapperType}`);
  }
  return query
    .parseReactElement(
      React.createElement(Element, {
        is: Comp,
        canvas: entry?.isCanvas ?? true,
        ...(entry?.defaultProps as Record<string, unknown>),
      }),
    )
    .toNodeTree();
};

/**
 * Whether `nodeIds` are consecutive siblings under one parent (order preserved).
 */
export const areConsecutiveSiblings = (query: EditorQuery, nodeIds: string[]): boolean => {
  if (nodeIds.length === 0) return false;
  let parent: string | null | undefined;
  try {
    parent = query.node(nodeIds[0]).get().data.parent;
  } catch {
    return false;
  }
  if (!parent) return false;
  for (const id of nodeIds) {
    try {
      if (query.node(id).get().data.parent !== parent) return false;
    } catch {
      return false;
    }
  }
  const siblings = query.node(parent).get().data.nodes;
  const indices = nodeIds.map((id) => siblings.indexOf(id)).sort((a, b) => a - b);
  if (indices.some((i) => i < 0)) return false;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) return false;
  }
  return true;
};

/** Sort node ids by sibling order under their shared parent. */
export const sortBySiblingOrder = (query: EditorQuery, nodeIds: string[]): string[] => {
  if (nodeIds.length === 0) return [];
  const parent = query.node(nodeIds[0]).get().data.parent;
  if (!parent) return nodeIds;
  const siblings = query.node(parent).get().data.nodes;
  return [...nodeIds].sort((a, b) => siblings.indexOf(a) - siblings.indexOf(b));
};

/**
 * Wrap one or more consecutive sibling nodes in a new Section / Container / Grid.
 * Returns the new wrapper id, or null when the op is invalid.
 */
export const wrapNodes = (
  query: EditorQuery,
  actions: EditorActions,
  nodeIds: string[],
  wrapperType: WrapType,
): string | null => {
  if (nodeIds.length === 0 || !areConsecutiveSiblings(query, nodeIds)) return null;

  const ordered = sortBySiblingOrder(query, nodeIds);
  const parent = query.node(ordered[0]).get().data.parent;
  if (!parent) return null;

  const siblings = query.node(parent).get().data.nodes;
  const insertIndex = siblings.indexOf(ordered[0]);
  if (insertIndex < 0) return null;

  const tree = buildWrapperTree(query, wrapperType);
  actions.addNodeTree(tree, parent, insertIndex);
  const wrapperId = tree.rootNodeId;

  for (let i = 0; i < ordered.length; i++) {
    actions.move(ordered[i], wrapperId, i);
  }

  return wrapperId;
};

/**
 * Unwrap a Section / Container / Grid — children become siblings at the wrapper's
 * position. Returns promoted child ids (empty when the wrapper had no children).
 */
export const unwrapNode = (
  query: EditorQuery,
  actions: EditorActions,
  wrapperId: string,
): string[] | null => {
  if (!isWrapType(resolvedNameOf(query, wrapperId))) return null;

  const wrapper = query.node(wrapperId).get();
  const parent = wrapper.data.parent;
  if (!parent) return null;

  const siblings = query.node(parent).get().data.nodes;
  const wrapperIndex = siblings.indexOf(wrapperId);
  if (wrapperIndex < 0) return null;

  const children = [...wrapper.data.nodes];
  if (children.length === 0) {
    if (query.node(wrapperId).isDeletable()) actions.delete(wrapperId);
    return [];
  }

  const promoted: string[] = [];
  for (let i = 0; i < children.length; i++) {
    const childId = children[i];
    actions.move(childId, parent, wrapperIndex + i);
    promoted.push(childId);
  }

  if (query.node(wrapperId).isDeletable()) actions.delete(wrapperId);
  return promoted;
};
