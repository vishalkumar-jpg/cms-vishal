import type { BlockNode, NodeMap, SerializedLayout } from "./layout";

/**
 * Per-page chrome inheritance controls. Stored on the `pages.layout_options`
 * column. By default every non-homepage page inherits the homepage topbar,
 * navbar, and footer; each slot can be hidden independently.
 */
export interface PageLayoutOptions {
  /** When false, the page renders only its own layout (no homepage chrome). Default true. */
  inheritHomepageChrome?: boolean;
  hideTopbar?: boolean;
  hideNavbar?: boolean;
  hideFooter?: boolean;
}

export const DEFAULT_PAGE_LAYOUT_OPTIONS: Required<PageLayoutOptions> = {
  inheritHomepageChrome: true,
  hideTopbar: false,
  hideNavbar: false,
  hideFooter: false,
};

/** Slugs tried in order when resolving a site's homepage layout. */
export const HOMEPAGE_SLUG_CANDIDATES = ["home", "ob-homepage", "obhomepage"] as const;

export function isHomepageSlug(slug: string): boolean {
  return (HOMEPAGE_SLUG_CANDIDATES as readonly string[]).includes(slug);
}

export function normalizePageLayoutOptions(
  options?: PageLayoutOptions | null,
): Required<PageLayoutOptions> {
  return { ...DEFAULT_PAGE_LAYOUT_OPTIONS, ...(options ?? {}) };
}

export interface ChromeSlots {
  topbarId?: string;
  navbarId?: string;
  footerId?: string;
  bodyIds: string[];
}

function resolvedName(node: BlockNode | undefined): string {
  return node?.type?.resolvedName ?? "";
}

function sectionBackground(node: BlockNode | undefined): string {
  const styles = node?.props?.styles as Record<string, unknown> | undefined;
  const colors = styles?.colors as Record<string, unknown> | undefined;
  return String(colors?.backgroundColor ?? "")
    .trim()
    .toLowerCase();
}

const TOPBAR_BACKGROUNDS = new Set(["#147eff", "rgb(20, 126, 255)"]);
const FOOTER_BACKGROUNDS = new Set(["#002244", "rgb(0, 34, 68)"]);

function isTopbarNode(node: BlockNode | undefined): boolean {
  if (!node) return false;
  const name = resolvedName(node);
  if (name === "Topbar") return true;
  return name === "Section" && TOPBAR_BACKGROUNDS.has(sectionBackground(node));
}

function isFooterNode(node: BlockNode | undefined): boolean {
  if (!node) return false;
  const name = resolvedName(node);
  if (name === "Footer") return true;
  return name === "Section" && FOOTER_BACKGROUNDS.has(sectionBackground(node));
}

function isNavbarNode(node: BlockNode | undefined): boolean {
  return resolvedName(node) === "Navbar";
}

function rootChildIds(layout: SerializedLayout): string[] {
  const root = layout.nodes[layout.root];
  return [...(root?.nodes ?? [])];
}

/** Identify top-level chrome slots and the remaining body section ids. */
export function identifyChromeSlots(layout: SerializedLayout): ChromeSlots {
  const children = rootChildIds(layout);
  let topbarId: string | undefined;
  let navbarId: string | undefined;
  let footerId: string | undefined;

  for (const id of children) {
    if (isNavbarNode(layout.nodes[id])) {
      navbarId = id;
      break;
    }
  }

  const navIndex = navbarId ? children.indexOf(navbarId) : children.length;
  for (let i = 0; i < navIndex; i += 1) {
    const id = children[i];
    if (isTopbarNode(layout.nodes[id])) {
      topbarId = id;
      break;
    }
  }

  if (!topbarId && !navbarId) {
    for (const id of children) {
      if (isTopbarNode(layout.nodes[id])) {
        topbarId = id;
        break;
      }
    }
  }

  for (let i = children.length - 1; i >= 0; i -= 1) {
    const id = children[i];
    if (id === topbarId || id === navbarId) continue;
    if (isFooterNode(layout.nodes[id])) {
      footerId = id;
      break;
    }
  }

  const chromeIds = new Set([topbarId, navbarId, footerId].filter(Boolean) as string[]);
  const bodyIds = children.filter((id) => !chromeIds.has(id));

  return { topbarId, navbarId, footerId, bodyIds };
}

/** Collect a node id and every descendant referenced through nodes / linkedNodes. */
function collectSubtreeNodeIds(nodes: NodeMap, entryId: string): Set<string> {
  const ids = new Set<string>();
  const walk = (id: string): void => {
    if (ids.has(id)) return;
    ids.add(id);
    const node = nodes[id];
    if (!node) return;
    for (const child of node.nodes ?? []) walk(child);
    for (const linked of Object.values(node.linkedNodes ?? {})) walk(linked);
  };
  walk(entryId);
  return ids;
}

/**
 * Rebuild ROOT children to only the given body ids and drop every removed root
 * child subtree from the node map. Leaving stripped nodes behind with
 * `parent: ROOT` makes `repairLayout` reconnect them at the bottom of the page.
 */
export function layoutFromBodyIds(layout: SerializedLayout, bodyIds: string[]): SerializedLayout {
  const root = layout.nodes[layout.root];
  if (!root) return layout;

  const bodyIdSet = new Set(bodyIds);
  const removedRootChildren = (root.nodes ?? []).filter((id) => !bodyIdSet.has(id));

  const nodes = { ...layout.nodes };
  for (const id of removedRootChildren) {
    for (const removeId of collectSubtreeNodeIds(nodes, id)) {
      delete nodes[removeId];
    }
  }

  nodes[layout.root] = { ...root, nodes: [...bodyIds] };
  for (const id of bodyIds) {
    if (nodes[id]) nodes[id] = { ...nodes[id], parent: layout.root };
  }
  return { ...layout, nodes };
}

/** Remove detected chrome slots from a layout, keeping only body sections. */
export function stripChromeFromLayout(layout: SerializedLayout): SerializedLayout {
  const slots = identifyChromeSlots(layout);
  return layoutFromBodyIds(layout, slots.bodyIds);
}

/**
 * Reorder ROOT children to topbar → navbar → body → footer when chrome slots are
 * detected. Idempotent when order is already correct. Repairs layouts where
 * legacy orphan-reconnect appended chrome after body sections at publish time.
 */
export function normalizeChromeOrder(layout: SerializedLayout): SerializedLayout {
  const slots = identifyChromeSlots(layout);
  const { topbarId, navbarId, footerId, bodyIds } = slots;
  if (!topbarId && !navbarId && !footerId) return layout;

  const ordered = [
    ...(topbarId ? [topbarId] : []),
    ...(navbarId ? [navbarId] : []),
    ...bodyIds,
    ...(footerId ? [footerId] : []),
  ];

  const current = rootChildIds(layout);
  if (ordered.length === current.length && ordered.every((id, index) => id === current[index])) {
    return layout;
  }

  const root = layout.nodes[layout.root];
  if (!root) return layout;

  const nodes = { ...layout.nodes, [layout.root]: { ...root, nodes: ordered } };
  for (const id of ordered) {
    if (nodes[id]) nodes[id] = { ...nodes[id], parent: layout.root };
  }
  return { ...layout, nodes };
}

function cloneSubtree(
  layout: SerializedLayout,
  entryId: string,
  idPrefix: string,
): { nodes: NodeMap; rootId: string } {
  const nodes: NodeMap = {};
  const idMap = new Map<string, string>();

  const mapId = (oldId: string): string => {
    if (!idMap.has(oldId)) {
      const safe = oldId.replace(/[^a-zA-Z0-9_]/g, "_");
      idMap.set(oldId, `${idPrefix}${safe}`);
    }
    return idMap.get(oldId)!;
  };

  const walk = (oldId: string, parentId: string | null): string => {
    const src = layout.nodes[oldId];
    if (!src) return mapId(oldId);
    const newId = mapId(oldId);
    if (!nodes[newId]) {
      const childIds = (src.nodes ?? []).map((child) => walk(child, newId));
      const linkedNodes: Record<string, string> = {};
      for (const [key, linked] of Object.entries(src.linkedNodes ?? {})) {
        linkedNodes[key] = walk(linked, newId);
      }
      nodes[newId] = {
        ...src,
        parent: parentId,
        nodes: childIds,
        linkedNodes,
      };
    }
    return newId;
  };

  const rootId = walk(entryId, null);
  return { nodes, rootId };
}

function applyChromeVisibility(
  layout: SerializedLayout,
  slots: ChromeSlots,
  options: Required<PageLayoutOptions>,
): SerializedLayout {
  const hiddenIds = new Set<string>();
  if (options.hideTopbar && slots.topbarId) hiddenIds.add(slots.topbarId);
  if (options.hideNavbar && slots.navbarId) hiddenIds.add(slots.navbarId);
  if (options.hideFooter && slots.footerId) hiddenIds.add(slots.footerId);
  if (hiddenIds.size === 0) return layout;

  const children = rootChildIds(layout).filter((id) => !hiddenIds.has(id));
  return layoutFromBodyIds(layout, children);
}

/**
 * Compose a page layout with homepage chrome. Non-homepage pages inherit
 * topbar/navbar/footer from the homepage by default; hide flags remove slots.
 * Duplicate chrome embedded in child page layouts is stripped automatically.
 */
export function composePageWithHomepageChrome(
  pageLayout: SerializedLayout,
  homepageLayout: SerializedLayout | null,
  options: PageLayoutOptions | null | undefined,
  pageSlug: string,
): SerializedLayout {
  const opts = normalizePageLayoutOptions(options);
  const pageSlots = identifyChromeSlots(pageLayout);

  if (isHomepageSlug(pageSlug)) {
    const normalized = normalizeChromeOrder(pageLayout);
    const normalizedSlots = identifyChromeSlots(normalized);
    return applyChromeVisibility(normalized, normalizedSlots, opts);
  }

  const bodyLayout = layoutFromBodyIds(pageLayout, pageSlots.bodyIds);

  if (!opts.inheritHomepageChrome || !homepageLayout) {
    return bodyLayout;
  }

  const homeSlots = identifyChromeSlots(homepageLayout);
  const mergedNodes: NodeMap = { ...bodyLayout.nodes };
  const rootChildren: string[] = [];
  const prefix = `inh_${pageSlug.replace(/[^a-z0-9]/gi, "_")}_`;

  const addChrome = (slotId: string | undefined, hide: boolean): void => {
    if (!slotId || hide) return;
    const cloned = cloneSubtree(homepageLayout, slotId, prefix);
    Object.assign(mergedNodes, cloned.nodes);
    const clonedRoot = mergedNodes[cloned.rootId];
    if (clonedRoot) {
      mergedNodes[cloned.rootId] = { ...clonedRoot, parent: bodyLayout.root };
      rootChildren.push(cloned.rootId);
    }
  };

  addChrome(homeSlots.topbarId, opts.hideTopbar);
  addChrome(homeSlots.navbarId, opts.hideNavbar);

  for (const id of rootChildIds(bodyLayout)) {
    const node = mergedNodes[id];
    if (node) {
      mergedNodes[id] = { ...node, parent: bodyLayout.root };
      rootChildren.push(id);
    }
  }

  addChrome(homeSlots.footerId, opts.hideFooter);

  const rootNode = mergedNodes[bodyLayout.root];
  if (rootNode) {
    mergedNodes[bodyLayout.root] = { ...rootNode, nodes: rootChildren };
  }

  return {
    schemaVersion: bodyLayout.schemaVersion,
    root: bodyLayout.root,
    nodes: mergedNodes,
  };
}

/** Prepend/append global site chrome (header/footer layouts) around a page body. */
export function wrapLayoutWithGlobalChrome(
  pageLayout: SerializedLayout,
  headerLayout: SerializedLayout | null,
  footerLayout: SerializedLayout | null,
): SerializedLayout {
  if (!headerLayout && !footerLayout) return pageLayout;

  const mergedNodes: NodeMap = { ...pageLayout.nodes };
  const rootChildren: string[] = [];

  const addLayoutChildren = (src: SerializedLayout, idPrefix: string): void => {
    for (const childId of rootChildIds(src)) {
      const cloned = cloneSubtree(src, childId, idPrefix);
      Object.assign(mergedNodes, cloned.nodes);
      const clonedRoot = mergedNodes[cloned.rootId];
      if (clonedRoot) {
        mergedNodes[cloned.rootId] = { ...clonedRoot, parent: pageLayout.root };
        rootChildren.push(cloned.rootId);
      }
    }
  };

  if (headerLayout) addLayoutChildren(headerLayout, "glob_h_");

  for (const id of rootChildIds(pageLayout)) {
    const node = mergedNodes[id];
    if (node) {
      mergedNodes[id] = { ...node, parent: pageLayout.root };
      rootChildren.push(id);
    }
  }

  if (footerLayout) addLayoutChildren(footerLayout, "glob_f_");

  const rootNode = mergedNodes[pageLayout.root];
  if (rootNode) {
    mergedNodes[pageLayout.root] = { ...rootNode, nodes: rootChildren };
  }

  return {
    schemaVersion: pageLayout.schemaVersion,
    root: pageLayout.root,
    nodes: mergedNodes,
  };
}
