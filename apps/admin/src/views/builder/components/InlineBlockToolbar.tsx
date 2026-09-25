import * as React from "react";
import { useEditor } from "@craftjs/core";
import { ArrowUp, ArrowDown, Copy, Trash2, ClipboardPaste, Lock } from "lucide-react";
import { useNodeActions } from "../hooks/useNodeActions";
import { WrapToolbarMenu } from "./WrapActions";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Floating inline block toolbar (A4). Pinned to the top-right of the currently
 * selected block's real DOM rect (read from Craft's `node.dom`). Buttons reuse
 * the shared {@link useNodeActions} so they flow through Craft actions =>
 * autosave + undo/redo. Rendered as a fixed-position overlay so it never
 * participates in the canvas layout and can't shift the block it points at.
 *
 * Guards: never shown for ROOT / non-deletable nodes, nor in Content mode (its
 * actions are all structural — Content mode is inline-edit-only). `stopPropagation`
 * + `onMouseDown preventDefault` keep clicks from starting a Craft drag or
 * deselecting the node.
 */
export const InlineBlockToolbar: React.FC = () => {
  const actions = useNodeActions();
  const confirmOpen = useEditorUiStore((s) => s.modalDialogOpen);
  const structureMode = useEditorUiStore((s) => s.editMode === "structure");
  const { selectedId, dom, displayName } = useEditor((state, query) => {
    const ids = query.getEvent("selected").all();
    const id = ids.length > 0 ? ids[ids.length - 1] : null;
    const node = id ? state.nodes[id] : undefined;
    return {
      selectedId: id,
      dom: node?.dom ?? null,
      displayName: node?.data.displayName ?? "",
    };
  });

  // Recompute the rect on scroll/resize so the toolbar tracks the block while
  // the canvas scrolls. A tick counter forces re-read of getBoundingClientRect.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!dom) return;
    const onChange = (): void => force();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [dom]);

  if (!structureMode || confirmOpen || !selectedId || !dom || actions.isRoot(selectedId)) return null;

  const rect = dom.getBoundingClientRect();
  // Clamp so the toolbar stays on-screen when the block touches the top edge.
  const top = Math.max(rect.top - 30, 4);
  const left = Math.min(rect.right - 4, window.innerWidth - 200);

  const stop = (e: React.SyntheticEvent): void => {
    e.stopPropagation();
  };

  const id = selectedId;
  const locked = actions.isLocked(id);
  return (
    <div
      className="fixed z-50 flex -translate-x-full items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 text-card-foreground shadow-md"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={stop}
      role="toolbar"
      aria-label={`${displayName} actions`}
    >
      <span className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">
        {locked && <Lock className="h-3 w-3" aria-label="Locked" />}
        {displayName}
      </span>
      <ToolbarButton
        label="Move up"
        disabled={locked || !actions.canMoveUp(id)}
        onClick={() => actions.moveUp(id)}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Move down"
        disabled={locked || !actions.canMoveDown(id)}
        onClick={() => actions.moveDown(id)}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Duplicate" disabled={locked} onClick={() => actions.duplicate(id)}>
        <Copy className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Paste after"
        disabled={locked || !actions.canPaste()}
        onClick={() => actions.paste(id)}
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
      </ToolbarButton>
      <WrapToolbarMenu nodeId={id} actions={actions} disabled={locked} />
      <ToolbarButton label="Delete" disabled={locked} onClick={() => actions.remove(id)}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </ToolbarButton>
    </div>
  );
};

const ToolbarButton: React.FC<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
  >
    {children}
  </button>
);
