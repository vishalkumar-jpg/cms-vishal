import * as React from "react";
import { useEditor, Element, type NodeTree } from "@craftjs/core";
import { blockRegistry } from "@ob-cms/blocks";
import { toast } from "@/components/ui/toaster";
import { resolver } from "../craft/resolver";
import { resolveRootInsertIndex, wrapNodeTreeInSection } from "../craft/nodeOps";

const REUSABLE_BLOCK = "Reusable Block";

/**
 * Insert a `Reusable Block` reference (by `reusableBlockId`) on the page canvas.
 * Shared by click-to-insert and drag-from-panel so both paths build the same tree.
 */
export const useReusableBlockInsert = () => {
  const { actions, query } = useEditor();

  const makeElement = React.useCallback((reusableBlockId: string) => {
    const entry = blockRegistry[REUSABLE_BLOCK];
    const Comp = resolver[REUSABLE_BLOCK as keyof typeof resolver];
    if (!entry || !Comp) return null;
    return (
      <Element
        is={Comp}
        canvas={entry.isCanvas}
        {...({
          ...(entry.defaultProps as Record<string, unknown>),
          reusableBlockId,
        } as Record<string, unknown>)}
      />
    );
  }, []);

  const makeDragTree = React.useCallback(
    (reusableBlockId: string): NodeTree | null => {
      try {
        const el = makeElement(reusableBlockId);
        if (!el) return null;
        const tree = query.parseReactElement(el).toNodeTree();
        return wrapNodeTreeInSection(query, tree);
      } catch {
        return null;
      }
    },
    [makeElement, query],
  );

  const focusInsertedNode = React.useCallback(
    (nodeId: string): void => {
      try {
        actions.selectNode(nodeId);
        requestAnimationFrame(() => {
          try {
            query.node(nodeId).get().dom?.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            /* dom not mounted yet */
          }
        });
      } catch {
        /* ignore */
      }
    },
    [actions, query],
  );

  const insert = React.useCallback(
    (reusableBlockId: string): boolean => {
      const tree = makeDragTree(reusableBlockId);
      if (!tree) {
        toast.error("Reusable Block is not registered in the editor");
        return false;
      }
      try {
        actions.addNodeTree(tree, "ROOT", resolveRootInsertIndex(query));
        focusInsertedNode(tree.rootNodeId);
        return true;
      } catch {
        toast.error("Could not insert reusable block");
        return false;
      }
    },
    [actions, focusInsertedNode, makeDragTree, query],
  );

  const insertAt = React.useCallback(
    (reusableBlockId: string, index: number): boolean => {
      const tree = makeDragTree(reusableBlockId);
      if (!tree) {
        toast.error("Reusable Block is not registered in the editor");
        return false;
      }
      try {
        actions.addNodeTree(tree, "ROOT", index);
        focusInsertedNode(tree.rootNodeId);
        return true;
      } catch {
        toast.error("Could not insert reusable block");
        return false;
      }
    },
    [actions, focusInsertedNode, makeDragTree],
  );

  return { makeElement, makeDragTree, insert, insertAt, focusInsertedNode };
};
