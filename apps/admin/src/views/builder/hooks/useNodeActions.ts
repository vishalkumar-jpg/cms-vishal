import { useCallback } from "react";
import { useEditor } from "@craftjs/core";
import {
  areConsecutiveSiblings,
  buildTreeFromSerializedMap,
  canMoveDown,
  canMoveUp,
  duplicateNode,
  isWrapType,
  moveNode,
  pasteSubtree,
  resolvedNameOf,
  serializeSubtree,
  sortBySiblingOrder,
  unwrapNode,
  wrapNodes,
  type WrapType,
} from "../craft/nodeOps";
import { layoutToCraft } from "../craft/serialize";
import {
  expandCompositeToLayout,
  isConvertibleComposite,
} from "../sections/expandComposite";
import { useEditorUiStore } from "../store/editorUiStore";
import { useReadGuardrails, useCanDesign } from "../guardrails/useGuardrails";
import { readLayerMeta } from "../craft/layerMeta";

/**
 * The single source of truth for on-canvas block operations (move/duplicate/
 * delete/copy/paste). The inline toolbar, the right-click context menu and the
 * keyboard shortcuts all call into these so behavior is identical everywhere and
 * everything flows through Craft's actions (=> autosave + undo/redo).
 *
 * `extraSelected` (multi-select via Shift+Click) is honored: delete and
 * duplicate fan out across the primary + extra selection.
 */
export interface NodeActions {
  canMoveUp: (id: string) => boolean;
  canMoveDown: (id: string) => boolean;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  copy: (id: string) => void;
  paste: (afterId: string | null) => void;
  canPaste: () => boolean;
  /** True for ROOT / non-deletable nodes — callers disable destructive UI. */
  isRoot: (id: string) => boolean;
  /** True when the node is locked AND constraints apply to this user (brand guardrails). */
  isLocked: (id: string) => boolean;
  /** True when this node is a composite block that can be expanded to editable nodes. */
  canConvert: (id: string) => boolean;
  /**
   * "Convert to Builder Component" — replace a composite block (Hero/Feature
   * List/…) in place with an equivalent tree of editable primitive nodes,
   * preserving its props + styles. No-op for non-convertible / locked nodes.
   */
  convertToNodes: (id: string) => void;
  /** True when the node can be wrapped (not root/locked, has a parent). */
  canWrap: (id: string) => boolean;
  /** True when the node is a Section/Container/Grid with a parent. */
  canUnwrap: (id: string) => boolean;
  /** Wrap the selection in a layout wrapper; honors multi-select when consecutive. */
  wrap: (id: string, wrapperType: WrapType) => void;
  /** Promote wrapper children to siblings and remove the wrapper. */
  unwrap: (id: string) => void;
  /** Select all siblings of the node (keeps primary + extras). */
  selectSiblings: (id: string) => void;
  /** Select all direct children. */
  selectChildren: (id: string) => void;
  /** Select all nodes of the same block type on the page. */
  selectSameType: (id: string) => void;
  /** Copy visual styles from a block. */
  copyStyles: (id: string) => void;
  /** Paste copied styles onto selection. */
  pasteStyles: (id: string) => void;
  canPasteStyles: () => boolean;
}

export const useNodeActions = (): NodeActions => {
  const { query, actions } = useEditor();
  const clipboard = useEditorUiStore((s) => s.clipboard);
  const setClipboard = useEditorUiStore((s) => s.setClipboard);
  const styleClipboard = useEditorUiStore((s) => s.styleClipboard);
  const setStyleClipboard = useEditorUiStore((s) => s.setStyleClipboard);
  const extraSelected = useEditorUiStore((s) => s.extraSelected);
  const setExtraSelected = useEditorUiStore((s) => s.setExtraSelected);
  const clearExtraSelected = useEditorUiStore((s) => s.clearExtraSelected);
  // DUAL-MODE — Content mode is inline-edit-only: structural mutations (move,
  // duplicate, delete, paste) are gated off here so EVERY caller (inline toolbar,
  // context menu, keyboard shortcuts) respects the mode from one place.
  const structureMode = useEditorUiStore((s) => s.editMode === "structure");
  const readGuardrails = useReadGuardrails();
  const canDesign = useCanDesign();

  // A node is "locked" for action purposes when either:
  //  - it carries the Layers-panel editor lock (custom.layer.locked) — applies to
  //    EVERYONE (Figma-style pin), or
  //  - it carries a brand guardrail lock AND the user is constrained (designers/
  //    admins bypass that one to manage the page).
  const isLocked = useCallback(
    (id: string): boolean => {
      try {
        const custom = query.node(id).get().data.custom;
        if (readLayerMeta(custom).locked === true) return true;
      } catch {
        /* node gone — fall through */
      }
      if (canDesign) return false;
      return readGuardrails(id).locked === true;
    },
    [canDesign, readGuardrails, query],
  );

  const targets = useCallback(
    (id: string): string[] => {
      const set = new Set<string>([id, ...extraSelected]);
      return [...set].filter((nid) => {
        try {
          const node = query.node(nid).get();
          if (node.data.parent == null) return false; // never act on ROOT
          if (isLocked(nid)) return false; // brand-locked: block destructive ops
          return true;
        } catch {
          return false;
        }
      });
    },
    [extraSelected, query, isLocked],
  );

  const isRoot = useCallback(
    (id: string): boolean => {
      try {
        return !query.node(id).isDeletable();
      } catch {
        return true;
      }
    },
    [query],
  );

  /** The node's serialized `type.resolvedName` (the registry/block key). */
  const resolvedNameOfId = useCallback(
    (id: string): string | undefined => resolvedNameOf(query, id),
    [query],
  );

  const canConvert = useCallback(
    (id: string): boolean => {
      if (!structureMode || isLocked(id) || isRoot(id)) return false;
      return isConvertibleComposite(resolvedNameOfId(id));
    },
    [structureMode, isLocked, isRoot, resolvedNameOfId],
  );

  const wrapTargets = useCallback(
    (id: string): string[] => {
      const ids = targets(id);
      if (ids.length <= 1) return ids;
      return areConsecutiveSiblings(query, ids) ? sortBySiblingOrder(query, ids) : [id];
    },
    [targets, query],
  );

  const canWrap = useCallback(
    (id: string): boolean => {
      if (!structureMode || isLocked(id) || isRoot(id)) return false;
      const toWrap = wrapTargets(id);
      if (toWrap.length === 0) return false;
      try {
        return toWrap.every((nid) => !!query.node(nid).get().data.parent);
      } catch {
        return false;
      }
    },
    [structureMode, isLocked, isRoot, wrapTargets, query],
  );

  const canUnwrap = useCallback(
    (id: string): boolean => {
      if (!structureMode || isLocked(id) || isRoot(id)) return false;
      return isWrapType(resolvedNameOfId(id));
    },
    [structureMode, isLocked, isRoot, resolvedNameOfId],
  );

  const wrap = useCallback(
    (id: string, wrapperType: WrapType): void => {
      if (!canWrap(id)) return;
      const toWrap = wrapTargets(id);
      const wrapperId = wrapNodes(query, actions, toWrap, wrapperType);
      if (wrapperId) actions.selectNode(wrapperId);
    },
    [canWrap, wrapTargets, query, actions],
  );

  const unwrap = useCallback(
    (id: string): void => {
      if (!canUnwrap(id)) return;
      const promoted = unwrapNode(query, actions, id);
      if (promoted && promoted.length > 0) actions.selectNode(promoted[0]);
      else clearExtraSelected();
    },
    [canUnwrap, query, actions, clearExtraSelected],
  );

  const convertToNodes = useCallback(
    (id: string): void => {
      if (!canConvert(id)) return;
      const name = resolvedNameOfId(id);
      if (!name) return;
      let props: Record<string, unknown> = {};
      let parent: string | null = null;
      let index: number | undefined;
      try {
        const node = query.node(id).get();
        props = (node.data.props ?? {}) as Record<string, unknown>;
        parent = node.data.parent ?? null;
        if (parent) {
          const siblings = query.node(parent).get().data.nodes;
          const at = siblings.indexOf(id);
          if (at >= 0) index = at;
        }
      } catch {
        return;
      }
      if (!parent) return;

      const layout = expandCompositeToLayout(name, props);
      if (!layout) return;

      try {
        const map = layoutToCraft(layout);
        const childId = (map["ROOT"]?.nodes ?? [])[0];
        if (!childId) return;
        const tree = buildTreeFromSerializedMap(query, map, childId);
        // Insert the expanded tree where the composite lived, then remove the
        // original so the swap is in place (one undo step reverts the whole op).
        actions.addNodeTree(tree, parent, index);
        if (query.node(id).isDeletable()) actions.delete(id);
        actions.selectNode(tree.rootNodeId);
      } catch {
        /* leave the original untouched on any failure */
      }
    },
    [canConvert, resolvedNameOfId, query, actions],
  );

  const selectSiblings = useCallback(
    (id: string): void => {
      try {
        const parent = query.node(id).get().data.parent;
        if (!parent) return;
        const siblings = query.node(parent).get().data.nodes ?? [];
        actions.selectNode(id);
        setExtraSelected(siblings.filter((s) => s !== id));
      } catch {
        /* ignore */
      }
    },
    [query, actions, setExtraSelected],
  );

  const selectChildren = useCallback(
    (id: string): void => {
      try {
        const node = query.node(id).get();
        const kids = node.data.nodes ?? [];
        if (kids.length === 0) return;
        actions.selectNode(kids[0]);
        setExtraSelected(kids.slice(1));
      } catch {
        /* ignore */
      }
    },
    [query, actions, setExtraSelected],
  );

  const selectSameType = useCallback(
    (id: string): void => {
      const type = resolvedNameOfId(id);
      if (!type) return;
      const matches: string[] = [];
      for (const nid of Object.keys(query.getNodes())) {
        if (nid === "ROOT") continue;
        try {
          if (resolvedNameOf(query, nid) === type) matches.push(nid);
        } catch {
          /* skip */
        }
      }
      if (matches.length === 0) return;
      actions.selectNode(matches[0]);
      setExtraSelected(matches.slice(1));
    },
    [query, actions, resolvedNameOfId, setExtraSelected],
  );

  const copyStyles = useCallback(
    (id: string): void => {
      try {
        const props = query.node(id).get().data.props as Record<string, unknown>;
        const styles = props.styles;
        setStyleClipboard(
          styles && typeof styles === "object" ? (JSON.parse(JSON.stringify(styles)) as Record<string, unknown>) : null,
        );
      } catch {
        setStyleClipboard(null);
      }
    },
    [query, setStyleClipboard],
  );

  const pasteStyles = useCallback(
    (id: string): void => {
      if (!structureMode || !styleClipboard) return;
      for (const nid of targets(id)) {
        if (isLocked(nid)) continue;
        actions.setProp(nid, (props: Record<string, unknown>) => {
          props.styles = JSON.parse(JSON.stringify(styleClipboard));
        });
      }
    },
    [structureMode, styleClipboard, targets, isLocked, actions],
  );

  return {
    canMoveUp: (id) => structureMode && !isLocked(id) && canMoveUp(query, id),
    canMoveDown: (id) => structureMode && !isLocked(id) && canMoveDown(query, id),
    moveUp: (id) => {
      if (!structureMode || isLocked(id)) return;
      moveNode(query, actions, id, -1);
    },
    moveDown: (id) => {
      if (!structureMode || isLocked(id)) return;
      moveNode(query, actions, id, 1);
    },
    duplicate: (id) => {
      if (!structureMode) return;
      let lastNew: string | null = null;
      for (const nid of targets(id)) lastNew = duplicateNode(query, actions, nid);
      if (lastNew) actions.selectNode(lastNew);
    },
    remove: (id) => {
      if (!structureMode) return;
      const ids = targets(id).filter((nid) => query.node(nid).isDeletable());
      if (ids.length === 0) return;
      actions.delete(ids);
      clearExtraSelected();
    },
    copy: (id) => setClipboard(serializeSubtree(query, id)),
    paste: (afterId) => {
      if (!structureMode || !clipboard) return;
      const fallbackParent =
        afterId && query.node(afterId).get().data.parent
          ? (query.node(afterId).get().data.parent as string)
          : "ROOT";
      const newId = pasteSubtree(query, actions, clipboard, fallbackParent, afterId ?? undefined);
      if (newId) actions.selectNode(newId);
    },
    canPaste: () => structureMode && clipboard != null,
    isRoot,
    isLocked,
    canConvert,
    convertToNodes,
    canWrap,
    canUnwrap,
    wrap,
    unwrap,
    selectSiblings,
    selectChildren,
    selectSameType,
    copyStyles,
    pasteStyles,
    canPasteStyles: () => structureMode && styleClipboard != null,
  };
};
