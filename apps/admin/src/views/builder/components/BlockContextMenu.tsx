import * as React from "react";
import { useEditor } from "@craftjs/core";
import { ArrowUp, ArrowDown, Copy, ClipboardPaste, Files, Trash2, Boxes, Users, GitBranch, Layers, Paintbrush } from "lucide-react";
import { useNodeActions } from "../hooks/useNodeActions";
import { WrapContextMenuItems } from "./WrapActions";

interface MenuState {
  x: number;
  y: number;
  nodeId: string;
}

/**
 * Right-click context menu (A5) for canvas blocks. A custom (non-Radix, since
 * the admin has no context-menu primitive) lightweight popover positioned at the
 * cursor. It listens for `contextmenu` on the canvas, maps the event target up
 * to the nearest Craft node by comparing against each node's real `dom`, selects
 * it, and offers the same operations as the inline toolbar (shared
 * {@link useNodeActions}).
 */
export const BlockContextMenu: React.FC = () => {
  const { query, actions } = useEditor();
  const nodeActions = useNodeActions();
  const [menu, setMenu] = React.useState<MenuState | null>(null);

  React.useEffect(() => {
    const findNodeId = (target: EventTarget | null): string | null => {
      const nodes = query.getNodes();
      let el = target as HTMLElement | null;
      while (el) {
        for (const id of Object.keys(nodes)) {
          if (id === "ROOT") continue;
          if (nodes[id]?.dom === el) return id;
        }
        el = el.parentElement;
      }
      return null;
    };

    const onContextMenu = (e: MouseEvent): void => {
      const id = findNodeId(e.target);
      if (!id) return;
      e.preventDefault();
      actions.selectNode(id);
      setMenu({ x: e.clientX, y: e.clientY, nodeId: id });
    };

    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, [query, actions]);

  React.useEffect(() => {
    if (!menu) return;
    const close = (): void => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  if (!menu) return null;
  const { nodeId } = menu;
  const root = nodeActions.isRoot(nodeId);
  const locked = nodeActions.isLocked(nodeId);
  const convertible = nodeActions.canConvert(nodeId);
  const left = Math.min(menu.x, window.innerWidth - 200);
  const top = Math.min(menu.y, window.innerHeight - 280);

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
    setMenu(null);
  };

  return (
    <div
      className="fixed z-[60] min-w-[11rem] overflow-hidden rounded-md border border-border bg-card p-1 text-card-foreground shadow-md"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {convertible ? (
        <>
          <Item
            icon={<Boxes className="h-3.5 w-3.5 text-primary" />}
            label="Convert to Builder Component"
            onClick={run(() => nodeActions.convertToNodes(nodeId))}
          />
          <div className="my-1 h-px bg-border" />
        </>
      ) : null}
      <Item
        icon={<ArrowUp className="h-3.5 w-3.5" />}
        label="Move up"
        disabled={root || locked || !nodeActions.canMoveUp(nodeId)}
        onClick={run(() => nodeActions.moveUp(nodeId))}
      />
      <Item
        icon={<ArrowDown className="h-3.5 w-3.5" />}
        label="Move down"
        disabled={root || locked || !nodeActions.canMoveDown(nodeId)}
        onClick={run(() => nodeActions.moveDown(nodeId))}
      />
      <div className="my-1 h-px bg-border" />
      <Item
        icon={<GitBranch className="h-3.5 w-3.5" />}
        label="Select siblings"
        disabled={root}
        onClick={run(() => nodeActions.selectSiblings(nodeId))}
      />
      <Item
        icon={<Layers className="h-3.5 w-3.5" />}
        label="Select children"
        disabled={root}
        onClick={run(() => nodeActions.selectChildren(nodeId))}
      />
      <Item
        icon={<Users className="h-3.5 w-3.5" />}
        label="Select same type"
        disabled={root}
        onClick={run(() => nodeActions.selectSameType(nodeId))}
      />
      <div className="my-1 h-px bg-border" />
      <Item
        icon={<Copy className="h-3.5 w-3.5" />}
        label="Copy"
        onClick={run(() => nodeActions.copy(nodeId))}
      />
      <Item
        icon={<Paintbrush className="h-3.5 w-3.5" />}
        label="Copy styles"
        onClick={run(() => nodeActions.copyStyles(nodeId))}
      />
      <Item
        icon={<ClipboardPaste className="h-3.5 w-3.5" />}
        label="Paste"
        disabled={!nodeActions.canPaste()}
        onClick={run(() => nodeActions.paste(nodeId))}
      />
      <Item
        icon={<Paintbrush className="h-3.5 w-3.5" />}
        label="Paste styles"
        disabled={!nodeActions.canPasteStyles()}
        onClick={run(() => nodeActions.pasteStyles(nodeId))}
      />
      <Item
        icon={<Files className="h-3.5 w-3.5" />}
        label="Duplicate"
        disabled={root || locked}
        onClick={run(() => nodeActions.duplicate(nodeId))}
      />
      <WrapContextMenuItems nodeId={nodeId} actions={nodeActions} onRun={run} />
      <div className="my-1 h-px bg-border" />
      <Item
        icon={<Trash2 className="h-3.5 w-3.5 text-destructive" />}
        label="Delete"
        disabled={root || locked}
        onClick={run(() => nodeActions.remove(nodeId))}
      />
    </div>
  );
};

const Item: React.FC<{
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
}> = ({ icon, label, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
  >
    {icon}
    {label}
  </button>
);
