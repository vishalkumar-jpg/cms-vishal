import type { useEditor } from "@craftjs/core";
import { resolvedNameOf } from "./nodeOps";
import { readLayerMeta } from "./layerMeta";

type EditorQuery = ReturnType<typeof useEditor>["query"];
type EditorActions = ReturnType<typeof useEditor>["actions"];

export type SimilarStyleGroup = "siblings" | "repeater" | "all";

export interface SimilarStyleTargets {
  siblings: string[];
  repeaterPeers: string[];
  allSimilar: string[];
}

const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const getAtPath = (obj: Record<string, unknown>, path: string): unknown => {
  let cursor: unknown = obj;
  for (const key of path.split(".")) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
};

const setAtPath = (obj: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
};

const collectDescendantIds = (query: EditorQuery, rootId: string): string[] => {
  const out: string[] = [];
  const visit = (id: string): void => {
    try {
      for (const child of query.node(id).get().data.nodes ?? []) {
        out.push(child);
        visit(child);
      }
    } catch {
      /* node removed */
    }
  };
  visit(rootId);
  return out;
};

/** Walk up the tree to the nearest Repeater ancestor (if any). */
export const findRepeaterAncestor = (query: EditorQuery, nodeId: string): string | null => {
  let cur: string | null = nodeId;
  for (let depth = 0; depth < 64 && cur; depth += 1) {
    try {
      const parent: string | null = query.node(cur).get().data.parent ?? null;
      if (!parent || parent === "ROOT") return null;
      if (resolvedNameOf(query, parent) === "Repeater") return parent;
      cur = parent;
    } catch {
      return null;
    }
  }
  return null;
};

/** Nodes that share the same block type in the relevant groups. */
export const findSimilarStyleTargets = (
  query: EditorQuery,
  nodeId: string,
): SimilarStyleTargets => {
  const type = resolvedNameOf(query, nodeId);
  const empty = { siblings: [], repeaterPeers: [], allSimilar: [] };
  if (!type) return empty;

  let parent: string | null = null;
  try {
    parent = query.node(nodeId).get().data.parent ?? null;
  } catch {
    return empty;
  }

  const sameType = (id: string): boolean => {
    try {
      return id !== nodeId && resolvedNameOf(query, id) === type;
    } catch {
      return false;
    }
  };

  const siblings =
    parent && parent !== "ROOT"
      ? (query.node(parent).get().data.nodes ?? []).filter(sameType)
      : [];

  const repeaterId = findRepeaterAncestor(query, nodeId);
  const repeaterPeers = repeaterId
    ? collectDescendantIds(query, repeaterId).filter(sameType)
    : [];

  const allSimilar = Object.keys(query.getNodes()).filter(
    (id) => id !== "ROOT" && id !== nodeId && sameType(id),
  );

  return { siblings, repeaterPeers, allSimilar };
};

const resolveTargetIds = (group: SimilarStyleGroup, targets: SimilarStyleTargets): string[] => {
  if (group === "siblings") return targets.siblings;
  if (group === "repeater") return targets.repeaterPeers;
  return targets.allSimilar;
};

/** Read the style bag to copy (`styles` or a sub-part path like `partStyles.title`). */
export const readStyleSnapshot = (
  query: EditorQuery,
  sourceId: string,
  rootPath: string,
): unknown | null => {
  try {
    const props = (query.node(sourceId).get().data.props ?? {}) as Record<string, unknown>;
    const snap = getAtPath(props, rootPath);
    if (snap == null || typeof snap !== "object") return null;
    return deepClone(snap);
  } catch {
    return null;
  }
};

/**
 * Copy the source node's style bag onto every target in the chosen group.
 * Returns how many nodes were updated (0 when nothing to apply).
 */
export const applyStylesToSimilar = (
  query: EditorQuery,
  actions: EditorActions,
  sourceId: string,
  group: SimilarStyleGroup,
  rootPath: string,
  isTargetAllowed: (id: string) => boolean,
): number => {
  const snapshot = readStyleSnapshot(query, sourceId, rootPath);
  if (snapshot == null) return 0;

  const targets = findSimilarStyleTargets(query, sourceId);
  const ids = resolveTargetIds(group, targets).filter(isTargetAllowed);
  if (ids.length === 0) return 0;

  for (const targetId of ids) {
    actions.setProp(targetId, (props: Record<string, unknown>) => {
      setAtPath(props, rootPath, deepClone(snapshot));
    });
  }

  return ids.length;
};

/** Skip editor-locked nodes when bulk-applying. */
export const isBulkStyleTargetAllowed = (
  query: EditorQuery,
  nodeId: string,
  isBrandLocked: (id: string) => boolean,
): boolean => {
  try {
    const node = query.node(nodeId).get();
    if (readLayerMeta(node.data.custom).locked === true) return false;
    if (isBrandLocked(nodeId)) return false;
    return true;
  } catch {
    return false;
  }
};
