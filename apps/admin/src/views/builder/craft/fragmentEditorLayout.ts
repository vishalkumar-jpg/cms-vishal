import { blockRegistry } from "@ob-cms/blocks";
import {
  CURRENT_SCHEMA_VERSION,
  migrate,
  unwrapPassthroughFragment,
  type BlockNode,
  type NodeMap,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { craftToLayout, layoutToCraft, parseCraftNodes } from "./serialize";

const CRAFT_ROOT = "ROOT";
const ROOTFRAME_NAME = "RootFrame";

const freshId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const resolvedNameOf = (node: BlockNode | undefined): string | undefined => {
  if (!node?.type) return undefined;
  const t = node.type as { resolvedName?: string } | string;
  return typeof t === "string" ? t : t.resolvedName;
};

const isRootFrameNode = (node: BlockNode | undefined): boolean => {
  if (!node) return false;
  const name = resolvedNameOf(node);
  return name === ROOTFRAME_NAME || node.displayName === "Root";
};

/** Remap one node id across an entire Craft node map. */
const remapNodeId = (nodes: NodeMap, fromId: string, toId: string): NodeMap => {
  const out: NodeMap = {};
  for (const [id, node] of Object.entries(nodes)) {
    const newId = id === fromId ? toId : id;
    const n: BlockNode = { ...node };
    if (n.parent === fromId) n.parent = toId;
    if (n.nodes?.length) n.nodes = n.nodes.map((c) => (c === fromId ? toId : c));
    if (n.linkedNodes && Object.keys(n.linkedNodes).length > 0) {
      n.linkedNodes = Object.fromEntries(
        Object.entries(n.linkedNodes).map(([k, v]) => [k, v === fromId ? toId : v]),
      );
    }
    out[newId] = n;
  }
  return out;
};

const emptyDivFragment = (): SerializedLayout => {
  const divId = freshId();
  const div: BlockNode = {
    type: { resolvedName: "Div" },
    isCanvas: true,
    props: {},
    displayName: "Div",
    parent: null,
    nodes: [],
    linkedNodes: {},
    custom: {},
    hidden: false,
  };
  return migrate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: divId,
    nodes: { [divId]: div },
  });
};

const emptyFallbackFragment = (): SerializedLayout => emptyDivFragment();

const sectionWrapperFragment = (childIds: string[], nodes: NodeMap): SerializedLayout => {
  const sectionId = freshId();
  const sectionDefaults = blockRegistry.Section?.defaultProps ?? {};
  const next: NodeMap = {};
  for (const [id, node] of Object.entries(nodes)) {
    const n: BlockNode = { ...node };
    if (childIds.includes(id)) n.parent = sectionId;
    next[id] = n;
  }
  next[sectionId] = {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: { ...sectionDefaults },
    displayName: "Section",
    parent: null,
    nodes: [...childIds],
    linkedNodes: {},
    custom: {},
    hidden: false,
  };
  return migrate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: sectionId,
    nodes: next,
  });
};

/**
 * Wrap a reusable-block / chrome fragment under `RootFrame` so the editor canvas
 * behaves like the page builder (drop targets, section quick-insert, siblings).
 */
export const layoutToFragmentEditorJson = (layout: SerializedLayout): string => {
  let nodes = layoutToCraft(layout);
  const root = nodes[CRAFT_ROOT];
  if (!root || isRootFrameNode(root)) return JSON.stringify(nodes);

  const contentId = freshId();
  nodes = remapNodeId(nodes, CRAFT_ROOT, contentId);
  const contentNode = nodes[contentId];
  nodes[CRAFT_ROOT] = {
    type: { resolvedName: ROOTFRAME_NAME },
    isCanvas: true,
    props: {},
    displayName: "Root",
    nodes: [contentId],
    linkedNodes: {},
    parent: null,
    custom: {},
    hidden: false,
  };
  nodes[contentId] = { ...contentNode, parent: CRAFT_ROOT };
  return JSON.stringify(nodes);
};

/**
 * Strip the editor-only `RootFrame` wrapper before persisting a reusable block
 * or global chrome fragment.
 */
export const craftJsonToFragmentLayout = (craftJson: string): SerializedLayout => {
  // Strip editor-only RootFrame *before* migrate/repair — repair drops unknown
  // block types, so calling craftToLayout first would delete RootFrame and leave
  // root="ROOT" with no ROOT node (instances then show "has no content yet").
  const rawNodes = parseCraftNodes(craftJson);
  const rootNode = rawNodes[CRAFT_ROOT];
  if (!isRootFrameNode(rootNode)) return craftToLayout(craftJson);

  const childIds = rootNode.nodes ?? [];
  if (childIds.length === 0) return emptyFallbackFragment();

  const nodes = { ...rawNodes };
  delete nodes[CRAFT_ROOT];

  if (childIds.length === 1) {
    const fragmentRootId = childIds[0];
    if (!nodes[fragmentRootId]) return emptyFallbackFragment();
    nodes[fragmentRootId] = { ...nodes[fragmentRootId], parent: null };
    return unwrapPassthroughFragment(
      migrate({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        root: fragmentRootId,
        nodes,
      }),
    );
  }

  return unwrapPassthroughFragment(
    migrate(sectionWrapperFragment(childIds, nodes)),
  );
};

/** Blank reusable block starting point (single empty Div root). */
export const createEmptyReusableBlockLayout = (): SerializedLayout => emptyFallbackFragment();
