import { useEffect } from "react";
import { useEditor } from "@craftjs/core";
import { useNodeActions } from "./useNodeActions";

/**
 * Keyboard shortcuts for the builder:
 *  - Ctrl/Cmd+Z: undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y): redo
 *  - Ctrl/Cmd+C / V: copy / paste selected subtree (paste lands right AFTER the
 *    selection, or into it). Clipboard is builder-scoped (store), NOT the OS one.
 *  - Ctrl/Cmd+D: duplicate
 *  - Delete/Backspace: delete selected
 *
 * Editing guard: when focus is in an input/textarea/contentEditable (inline text
 * editing or a panel field) the clipboard/delete shortcuts are skipped so typing
 * is never hijacked. Undo/redo still work everywhere. All mutations go through
 * {@link useNodeActions} => Craft actions => autosave + undo/redo, and respect
 * the Shift+Click multi-selection.
 */
export const useEditorShortcuts = (): void => {
  const { actions, query } = useEditor();
  const nodeActions = useNodeActions();

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || node.isContentEditable;
    };

    const getSelected = (): string | null => {
      const selected = query.getEvent("selected").all();
      return selected.length > 0 ? selected[selected.length - 1] : null;
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.history.redo();
        else actions.history.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        actions.history.redo();
        return;
      }

      if (isEditable(e.target)) return;
      const selected = getSelected();

      if (mod && e.key.toLowerCase() === "c" && selected) {
        e.preventDefault();
        nodeActions.copy(selected);
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && nodeActions.canPaste()) {
        e.preventDefault();
        nodeActions.paste(selected);
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        nodeActions.duplicate(selected);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        nodeActions.remove(selected);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, query, nodeActions]);
};
