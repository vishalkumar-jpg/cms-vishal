import type { NavItem } from "./types";

/** Max nesting depth allowed by the server (depth 4 = 4 levels deep). */
export const MAX_DEPTH = 4;

/** A path of child indices identifying an item within a nested tree. */
export type IndexPath = number[];

const empty = (): NavItem => ({ label: "", href: "", children: [] });

/** Immutably map the item at `path`, returning a new tree. */
export const updateAt = (
  tree: NavItem[],
  path: IndexPath,
  fn: (item: NavItem) => NavItem,
): NavItem[] => {
  if (path.length === 0) return tree;
  const [index, ...rest] = path;
  return tree.map((item, i) => {
    if (i !== index) return item;
    if (rest.length === 0) return fn(item);
    return { ...item, children: updateAt(item.children, rest, fn) };
  });
};

/** Immutably operate on the sibling list that contains `path`'s last index. */
const updateSiblings = (
  tree: NavItem[],
  path: IndexPath,
  fn: (siblings: NavItem[]) => NavItem[],
): NavItem[] => {
  if (path.length === 0) return fn(tree);
  const [index, ...rest] = path;
  if (rest.length === 0) return fn(tree);
  return tree.map((item, i) =>
    i === index ? { ...item, children: updateSiblings(item.children, rest, fn) } : item,
  );
};

/** Append a new empty item to the children of `parentPath` (root when empty). */
export const addChild = (tree: NavItem[], parentPath: IndexPath): NavItem[] => {
  if (parentPath.length === 0) return [...tree, empty()];
  return updateAt(tree, parentPath, (item) => ({
    ...item,
    children: [...item.children, empty()],
  }));
};

/** Remove the item at `path`. */
export const removeAt = (tree: NavItem[], path: IndexPath): NavItem[] => {
  const last = path[path.length - 1];
  return updateSiblings(tree, path, (siblings) =>
    siblings.filter((_, i) => i !== last),
  );
};

/** Swap the item at `path` with the sibling at `path ± delta` (no-op at edges). */
export const moveAt = (tree: NavItem[], path: IndexPath, delta: -1 | 1): NavItem[] => {
  const last = path[path.length - 1];
  return updateSiblings(tree, path, (siblings) => {
    const target = last + delta;
    if (target < 0 || target >= siblings.length) return siblings;
    const next = [...siblings];
    [next[last], next[target]] = [next[target], next[last]];
    return next;
  });
};
