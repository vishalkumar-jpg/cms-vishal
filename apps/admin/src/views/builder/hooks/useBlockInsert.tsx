import * as React from "react";
import { useEditor, Element } from "@craftjs/core";
import { blockRegistry } from "@ob-cms/blocks";
import { resolver } from "../craft/resolver";
import { resolveRootInsertIndex } from "../craft/nodeOps";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Shared click-to-insert + element factory for palette / recommendations.
 * Inserts after the selected block's top-level section when possible, else appends.
 */
export const useBlockInsert = () => {
  const { actions, query } = useEditor();
  const pushRecentBlock = useEditorUiStore((s) => s.pushRecentBlock);

  const makeElement = React.useCallback(
    (name: string, propOverrides?: Record<string, unknown>) => {
      const entry = blockRegistry[name];
      if (!entry) return null;
      const Comp = resolver[name as keyof typeof resolver];
      return (
        <Element
          is={Comp}
          canvas={entry.isCanvas}
          {...(entry.defaultProps as Record<string, unknown>)}
          {...propOverrides}
        />
      );
    },
    [],
  );

  const resolveInsertIndex = React.useCallback(
    (): number | undefined => resolveRootInsertIndex(query),
    [query],
  );

  const insert = React.useCallback(
    (name: string, propOverrides?: Record<string, unknown>) => {
      const el = makeElement(name, propOverrides);
      if (!el) return;
      try {
        const tree = query.parseReactElement(el).toNodeTree();
        actions.addNodeTree(tree, "ROOT", resolveInsertIndex());
        pushRecentBlock(name);
      } catch {
        /* ignore invalid insert */
      }
    },
    [actions, query, makeElement, resolveInsertIndex, pushRecentBlock],
  );

  const insertAt = React.useCallback(
    (name: string, index: number, propOverrides?: Record<string, unknown>) => {
      const el = makeElement(name, propOverrides);
      if (!el) return;
      try {
        const tree = query.parseReactElement(el).toNodeTree();
        actions.addNodeTree(tree, "ROOT", index);
        pushRecentBlock(name);
      } catch {
        /* ignore invalid insert */
      }
    },
    [actions, query, makeElement, pushRecentBlock],
  );

  return { makeElement, insert, insertAt };
};
