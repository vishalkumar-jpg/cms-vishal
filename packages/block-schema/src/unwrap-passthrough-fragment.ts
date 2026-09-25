import type { BlockNode, NodeMap, SerializedLayout } from "./layout";
import { migrate } from "./migrate";
import { CONTAINER_DEFAULT_MAX_WIDTH, FLEX_CHILD_DEFAULT_FLEX } from "./block-props";

/** Layout wrappers that may be stripped when they only pass through a single child. */
const PASSTHROUGH_WRAPPER_TYPES = new Set([
  "Section",
  "Container",
  "Row",
  "Column",
  "Div",
  "Group",
]);

const FULL_WIDTH_FRAGMENT_ROOTS = new Set([
  "Section",
  "Container",
  "Grid",
  "Slider",
  "Navbar",
  "Footer",
  "Card",
]);

const stylesAreEffectivelyEmpty = (styles: unknown): boolean => {
  if (!styles || typeof styles !== "object") return true;
  const s = styles as Record<string, unknown>;
  for (const key of Object.keys(s)) {
    const v = s[key];
    if (v == null) continue;
    if (typeof v === "object" && Object.keys(v as object).length === 0) continue;
    return false;
  }
  return true;
};

const wrapperHasAuthoringSignificance = (node: BlockNode): boolean => {
  const props = (node.props ?? {}) as Record<string, unknown>;
  if (typeof props.className === "string" && props.className.trim().length > 0) return true;
  if (typeof props.sectionId === "string" && props.sectionId.trim().length > 0) return true;
  if (typeof props.tag === "string" && props.tag.trim().length > 0 && props.tag !== "section") {
    return true;
  }
  if (!stylesAreEffectivelyEmpty(props.styles)) return true;

  const type = node.type?.resolvedName;
  if (type === "Grid") {
    const columns = Number(props.columns ?? 0);
    if (columns > 1) return true;
  }
  if (type === "Container") {
    const maxWidth = props.maxWidth;
    if (maxWidth != null && maxWidth !== "" && maxWidth !== CONTAINER_DEFAULT_MAX_WIDTH) return true;
  }
  if (type === "Row" || type === "Column" || type === "Group") {
    const flex = props.flex;
    if (flex != null && flex !== "" && flex !== FLEX_CHILD_DEFAULT_FLEX) return true;
  }
  return false;
};

const childIdsOf = (node: BlockNode): string[] => [
  ...(node.nodes ?? []),
  ...Object.values(node.linkedNodes ?? {}),
];

/**
 * Promote a lone child when the fragment root is an unstyled Section/Container/Row
 * wrapper. Keeps intentional layout shells (padding, class names, grid columns).
 */
export const unwrapPassthroughFragment = (layout: SerializedLayout): SerializedLayout => {
  if (!layout?.nodes?.[layout.root]) return layout;

  let rootId = layout.root;
  const nodes: NodeMap = { ...layout.nodes };
  let changed = false;

  while (true) {
    const node = nodes[rootId];
    if (!node) break;

    const type = node.type?.resolvedName;
    if (!type || !PASSTHROUGH_WRAPPER_TYPES.has(type)) break;
    if (wrapperHasAuthoringSignificance(node)) break;

    const childIds = childIdsOf(node);
    if (childIds.length !== 1) break;

    const childId = childIds[0];
    const child = nodes[childId];
    if (!child) break;

    nodes[childId] = { ...child, parent: null };
    delete nodes[rootId];
    rootId = childId;
    changed = true;
  }

  if (!changed) return layout;
  return migrate({
    schemaVersion: layout.schemaVersion,
    root: rootId,
    nodes,
  });
};

/** Whether a reusable fragment should shrink-wrap (button, badge, icon, …). */
export const isIntrinsicWidthFragmentRoot = (layout: SerializedLayout): boolean => {
  const root = layout.nodes?.[layout.root];
  const type = root?.type?.resolvedName;
  if (!type) return false;
  return !FULL_WIDTH_FRAGMENT_ROOTS.has(type);
};
