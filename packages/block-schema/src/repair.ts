import { blockPropSchemas, validateBlockProps, normalizeNavbarForLiveSite } from "./block-props";
import { emptyLayout, type NodeMap, type SerializedLayout } from "./layout";

/**
 * Node repair pass — ports the POC `repairCraftNodes` logic and hardens it.
 * Runs on every read (importer + migrator):
 *  - drop nodes whose type is unknown / unresolvable (and ChatWidget legacy),
 *  - normalise display-name aliases to a known block type,
 *  - validate + default props against each block's zod schema,
 *  - prune dangling child / linkedNode references,
 *  - guarantee a valid ROOT exists.
 */

export const CRAFT_ROOT = "ROOT";
const REMOVED_TYPES = new Set(["ChatWidget", "Chat Widget"]);

const repairId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `repair-${Date.now().toString(36)}`;

/**
 * Reusable-block saves that ran migrate/repair before stripping the editor-only
 * RootFrame left `root: "ROOT"` with no ROOT node while children still point at
 * `parent: "ROOT"`. Promote those dangling children back to a valid fragment root.
 */
const repairDanglingCraftRoot = (layout: SerializedLayout): SerializedLayout => {
  const { root, nodes } = layout;
  if (nodes[CRAFT_ROOT] || (root !== CRAFT_ROOT && nodes[root])) return layout;

  const danglingIds = Object.entries(nodes)
    .filter(([, node]) => node.parent === CRAFT_ROOT)
    .map(([id]) => id);
  if (danglingIds.length === 0) return layout;

  const next: NodeMap = { ...nodes };
  if (danglingIds.length === 1) {
    const fragmentRootId = danglingIds[0];
    next[fragmentRootId] = { ...next[fragmentRootId], parent: null };
    return { ...layout, root: fragmentRootId, nodes: next };
  }

  const sectionId = repairId();
  for (const id of danglingIds) {
    next[id] = { ...next[id], parent: sectionId };
  }
  next[sectionId] = {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: {},
    displayName: "Section",
    parent: null,
    nodes: [...danglingIds],
    linkedNodes: {},
    custom: {},
    hidden: false,
  };
  return { ...layout, root: sectionId, nodes: next };
};

/** Display-name / resolvedName aliases → canonical registry key. */
const ALIASES: Record<string, string> = {
  HeroSection: "Hero Section",
  ButtonBlock: "Button",
  LinkBlock: "Link",
  ImageBlock: "Image",
  FooterBlock: "Footer",
  Copyright: "Copyright Block",
  SectionHeading: "Section Heading",
};

const resolveType = (node: any): string | null => {
  const resolved: string | undefined = node?.type?.resolvedName;
  if (!resolved) return null;
  if (blockPropSchemas[resolved]) return resolved;
  if (ALIASES[resolved] && blockPropSchemas[ALIASES[resolved]]) return ALIASES[resolved];
  if (node.displayName && blockPropSchemas[node.displayName]) return node.displayName;
  return resolved;
};

/** Repair a raw Craft.js node map in place-ish; returns a clean NodeMap. */
export const repairNodes = (rawNodes: unknown): NodeMap => {
  if (!rawNodes || typeof rawNodes !== "object") {
    return emptyLayout().nodes;
  }

  const working: Record<string, any> = { ...(rawNodes as Record<string, any>) };
  const deleteIds = new Set<string>();

  // Pass 1: resolve types + drop unknown/removed nodes.
  for (const [id, node] of Object.entries(working)) {
    if (!node?.type) {
      deleteIds.add(id);
      continue;
    }
    const resolved = node.type?.resolvedName;
    if (REMOVED_TYPES.has(resolved)) {
      deleteIds.add(id);
      continue;
    }
    const fixed = resolveType(node);
    if (!fixed || !blockPropSchemas[fixed]) {
      deleteIds.add(id);
      continue;
    }
    let next = node;
    if (fixed !== resolved) {
      next = { ...node, type: { ...node.type, resolvedName: fixed } };
    }
    // Validate + fill defaults for props.
    const result = validateBlockProps(fixed, next.props);
    if (result.ok) {
      let props = result.props;
      // Navbar: legacy `navItems`/`links` must win over empty composed canvas.
      if (fixed === "Navbar") {
        const navItems = props.navItems;
        const links = props.links;
        const hasLegacyItems =
          (Array.isArray(navItems) && navItems.length > 0) ||
          (Array.isArray(links) && links.length > 0);
        const hasChildren = Array.isArray(next.nodes) && next.nodes.length > 0;
        if (hasLegacyItems && !hasChildren) {
          props = { ...props, mode: "legacy" };
        }
        props = normalizeNavbarForLiveSite(props);
      }
      next = {
        ...next,
        props,
        isCanvas: Boolean(next.isCanvas),
        nodes: Array.isArray(next.nodes) ? next.nodes : [],
        linkedNodes: next.linkedNodes && typeof next.linkedNodes === "object" ? next.linkedNodes : {},
        custom: next.custom && typeof next.custom === "object" ? next.custom : {},
        parent: next.parent ?? null,
        hidden: Boolean(next.hidden),
        displayName: next.displayName ?? fixed,
      };
    }
    working[id] = next;
  }

  for (const id of deleteIds) delete working[id];

  // Pass 2: prune dangling references, drop self-references, dedupe repeated
  // child ids, and enforce single-parent ownership. A node id that appears in
  // two parents' `nodes` (or twice in one) makes Craft render the same node
  // twice — surfacing as React's "Encountered two children with the same key"
  // warning and, on delete, dangling-ref crashes. We keep the first claim
  // (ROOT processed first so top-level ownership is stable) and repoint each
  // kept child's `parent` at its real owner.
  const claimed = new Set<string>();
  const orderedIds = Object.keys(working).sort((a, b) =>
    a === "ROOT" ? -1 : b === "ROOT" ? 1 : 0,
  );
  for (const id of orderedIds) {
    const node = working[id];
    if (!node) continue;
    if (Array.isArray(node.nodes)) {
      node.nodes = node.nodes.filter((childId: string) => {
        if (!working[childId] || childId === id || claimed.has(childId)) return false;
        claimed.add(childId);
        if (working[childId]) working[childId].parent = id;
        return true;
      });
    }
    if (node.linkedNodes && typeof node.linkedNodes === "object") {
      node.linkedNodes = Object.fromEntries(
        Object.entries(node.linkedNodes).filter(([, childId]) => {
          const cid = childId as string;
          if (!working[cid] || cid === id || claimed.has(cid)) return false;
          claimed.add(cid);
          if (working[cid]) working[cid].parent = id;
          return true;
        }),
      );
    }
  }

  // Pass 2.5: reconnect orphaned ROOT children. A node with parent === CRAFT_ROOT
  // that was NOT in ROOT.nodes before Pass 2 (or was filtered out as a duplicate
  // by another parent) is dangling in the tree — Craft.js and RenderLayout both
  // traverse only ROOT.nodes, so orphaned chrome (Navbar, Section, etc.) goes
  // unrendered. Reconnect these to ROOT in their original order while preserving
  // the ordering Pass 2 established. This is the inverse of what Pass 2 does:
  // Pass 2 prunes stale child references; this pass re-attaches stale children
  // whose `parent` points at ROOT but whose id was never listed there.
  //
  // Safety: only reconnects nodes whose parent is ROOT (the page root), not
  // arbitrary fragments (which use their own root id and never reach this branch
  // since they return early at Pass 3). Idempotent: re-running repairLayout a
  // second time finds the node already in ROOT.nodes and leaves it alone.
  if (working[CRAFT_ROOT]) {
    const rootNode = working[CRAFT_ROOT];
    const rootChildren: string[] = Array.isArray(rootNode?.nodes) ? rootNode.nodes : [];
    const linkedRootChildren = Object.values(rootNode?.linkedNodes ?? {}) as string[];
    const claimedSet = new Set<string>([...rootChildren, ...linkedRootChildren]);
    const orphanedRootChildren: string[] = [];
    for (const id of Object.keys(working)) {
      const node = working[id];
      if (id === CRAFT_ROOT) continue;
      if (node?.parent === CRAFT_ROOT && !claimedSet.has(id)) {
        orphanedRootChildren.push(id);
        claimedSet.add(id);
      }
    }
    if (orphanedRootChildren.length > 0) {
      rootNode.nodes = [...rootChildren, ...orphanedRootChildren];
    }
  }

  // Pass 3: full Craft page maps always carry a ROOT node. Reusable-block /
  // template fragments instead use their own root id (no CRAFT "ROOT" key) —
  // preserve those maps; only substitute the empty layout when nothing remains.
  if (!working.ROOT) {
    if (Object.keys(working).length === 0) {
      return emptyLayout().nodes;
    }
    return working as NodeMap;
  }

  return working as NodeMap;
};

/** Repair a whole layout (nodes + ensure root points at a real node). */
export const repairLayout = (layout: SerializedLayout): SerializedLayout => {
  const withRoot = repairDanglingCraftRoot(layout);
  const nodes = repairNodes(withRoot.nodes);
  let root = withRoot.root;
  if (!nodes[root]) {
    if (nodes[CRAFT_ROOT]) root = CRAFT_ROOT;
    else {
      const orphan = Object.entries(nodes).find(([, n]) => n.parent == null);
      root = orphan?.[0] ?? CRAFT_ROOT;
    }
  }
  return { ...layout, root, nodes };
};
