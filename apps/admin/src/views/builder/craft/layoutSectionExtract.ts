import type { SerializedLayout } from "@ob-cms/block-schema";
import { wrapFragmentUnderTemplateRoot } from "../craft/nodeOps";
import { regenerateLayoutIds } from "./regenerateLayoutIds";

/** Top-level band node ids under a page layout ROOT wrapper. */
export function listTopLevelBandNodeIds(layout: SerializedLayout): string[] {
  const root = layout.nodes[layout.root];
  if (!root?.nodes?.length) return [];
  return root.nodes;
}

/** Collect a self-contained subtree fragment starting at `bandNodeId`. */
export function extractSubtreeFromLayout(
  layout: SerializedLayout,
  bandNodeId: string,
): SerializedLayout {
  const nodes: SerializedLayout["nodes"] = {};
  const visit = (nodeId: string, parent: string | null): void => {
    if (nodes[nodeId]) return;
    const node = layout.nodes[nodeId];
    if (!node) return;
    nodes[nodeId] = {
      ...node,
      parent: nodeId === bandNodeId ? null : parent,
    };
    for (const childId of node.nodes ?? []) {
      visit(childId, nodeId);
    }
    for (const linkedId of Object.values(node.linkedNodes ?? {})) {
      if (linkedId) visit(linkedId, nodeId);
    }
  };
  visit(bandNodeId, null);
  if (!nodes[bandNodeId]) {
    throw new Error(`Band node not found: ${bandNodeId}`);
  }
  return {
    schemaVersion: layout.schemaVersion,
    root: bandNodeId,
    nodes,
  };
}

/** Resolve a top-level band by index as a detached subtree fragment. */
export function extractBandLayoutByIndex(
  pageLayout: SerializedLayout,
  bandIndex: number,
): SerializedLayout {
  const bandIds = listTopLevelBandNodeIds(pageLayout);
  const bandNodeId = bandIds[bandIndex];
  if (!bandNodeId) {
    throw new Error(`Band index ${bandIndex} is out of range (${bandIds.length} bands)`);
  }
  return extractSubtreeFromLayout(pageLayout, bandNodeId);
}

/** Extract one starter section band and mint fresh ids for collision-free insert. */
export function prepareStarterSectionLayout(
  pageLayout: SerializedLayout,
  bandIndex: number,
): SerializedLayout {
  const fragment = extractBandLayoutByIndex(pageLayout, bandIndex);
  return regenerateLayoutIds(wrapFragmentUnderTemplateRoot(fragment));
}
