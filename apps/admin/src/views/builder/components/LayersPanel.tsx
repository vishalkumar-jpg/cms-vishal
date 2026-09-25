import * as React from "react";
import { useEditor } from "@craftjs/core";
import { ChevronRight, ChevronDown, Eye, EyeOff, Lock, Unlock, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { isLayerLocked, readLayerMeta, resolveLayerName, useLayerMeta } from "../craft/layerMeta";
import { LayerFolderBar } from "./LayerFolderBar";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Layers panel — a Figma-style tree built from Craft's node graph. Everything is
 * synced with the Craft tree so the canvas updates instantly:
 *
 *  - select       : click a row (Craft `selectNode`).
 *  - rename       : double-click the label → inline input (`custom.layer.name`).
 *  - hide / show  : eye toggle (Craft native `setHidden` — removed from canvas).
 *  - lock / unlock: lock toggle (`custom.layer.locked` — blocks drag/reorder).
 *  - reorder      : drag a row onto another (before / after / inside) → `move`.
 */

type EditorQuery = ReturnType<typeof useEditor>["query"];
type EditorActions = ReturnType<typeof useEditor>["actions"];
type DropRegion = "before" | "after" | "inside";
interface DropTarget {
  id: string;
  region: DropRegion;
}

interface DragCtx {
  dragId: string | null;
  setDragId: (id: string | null) => void;
  dropTarget: DropTarget | null;
  setDropTarget: (t: DropTarget | null) => void;
  onDrop: (targetId: string, region: DropRegion) => void;
  isDescendant: (ancestorId: string, maybeChildId: string) => boolean;
  /** Bumped to force collapse/expand all. */
  expandSignal: number;
  forceOpen: boolean | null;
}

const LayerDragContext = React.createContext<DragCtx | null>(null);
const LAYER_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

const collectChildren = (node: {
  data: { nodes?: string[]; linkedNodes?: Record<string, string> };
}): string[] => [...(node.data.nodes ?? []), ...Object.values(node.data.linkedNodes ?? {})];

export const LayersPanel: React.FC = () => {
  const { rootChildren, selectedId, actions, query } = useEditor((state) => {
    const root = state.nodes["ROOT"];
    const selected = state.events.selected;
    return {
      rootChildren: root ? collectChildren(root) : [],
      selectedId: selected && selected.size > 0 ? Array.from(selected)[0] : null,
    };
  });
  const { setLocked } = useLayerMeta();

  const [filter, setFilter] = React.useState("");
  const [expandSignal, setExpandSignal] = React.useState(0);
  const [forceOpen, setForceOpen] = React.useState<boolean | null>(null);

  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);

  /** True when `maybeChildId` is `ancestorId` itself or nested under it. */
  const isDescendant = React.useCallback(
    (ancestorId: string, maybeChildId: string): boolean => {
      if (ancestorId === maybeChildId) return true;
      try {
        return query.node(ancestorId).descendants(true).includes(maybeChildId);
      } catch {
        return false;
      }
    },
    [query],
  );

  const onDrop = React.useCallback(
    (targetId: string, region: DropRegion) => {
      const source = dragId;
      setDragId(null);
      setDropTarget(null);
      if (!source || source === targetId) return;
      // Never drop a node into its own subtree.
      if (isDescendant(source, targetId)) return;
      moveLayer(query, actions, source, targetId, region);
    },
    [dragId, isDescendant, query, actions],
  );

  const ctx = React.useMemo<DragCtx>(
    () => ({ dragId, setDragId, dropTarget, setDropTarget, onDrop, isDescendant, expandSignal, forceOpen }),
    [dragId, dropTarget, onDrop, isDescendant, expandSignal, forceOpen],
  );

  const bulkHide = (): void => {
    for (const id of Object.keys(query.getNodes())) {
      if (id === "ROOT") continue;
      try {
        actions.setHidden(id, true);
      } catch {
        /* skip */
      }
    }
  };

  const bulkLock = (): void => {
    for (const id of Object.keys(query.getNodes())) {
      if (id === "ROOT") continue;
      setLocked(id, true);
    }
  };

  const dirtyVersion = useEditorUiStore((s) => s.dirtyVersion);
  const term = filter.trim().toLowerCase();
  const allNodeIds = React.useMemo(
    () => Object.keys(query.getNodes()).filter((id) => id !== "ROOT"),
    [query, dirtyVersion],
  );

  if (rootChildren.length === 0) {
    return <p className="p-4 text-xs text-muted-foreground">Canvas is empty.</p>;
  }

  return (
    <LayerDragContext.Provider value={ctx}>
      <div className="flex flex-col py-2">
        <LayerFolderBar nodeIds={allNodeIds} onSelectNode={(id) => actions.selectNode(id)} />
        <div className="px-3 pb-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search layers…"
            aria-label="Search layers"
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              title="Collapse all"
              aria-label="Collapse all layers"
              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              onClick={() => {
                setForceOpen(false);
                setExpandSignal((n) => n + 1);
              }}
            >
              <ChevronsDownUp className="inline h-3 w-3" /> Collapse
            </button>
            <button
              type="button"
              title="Expand all"
              aria-label="Expand all layers"
              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              onClick={() => {
                setForceOpen(true);
                setExpandSignal((n) => n + 1);
              }}
            >
              <ChevronsUpDown className="inline h-3 w-3" /> Expand
            </button>
            <button
              type="button"
              title="Hide all layers"
              aria-label="Hide all layers"
              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              onClick={bulkHide}
            >
              Hide all
            </button>
            <button
              type="button"
              title="Lock all layers"
              aria-label="Lock all layers"
              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              onClick={bulkLock}
            >
              Lock all
            </button>
          </div>
        </div>
        {rootChildren.map((childId) => (
          <LayerNode
            key={childId}
            nodeId={childId}
            depth={0}
            selectedId={selectedId}
            filter={term}
            onSelect={(id) => actions.selectNode(id)}
          />
        ))}
      </div>
    </LayerDragContext.Provider>
  );
};

/**
 * Reorder `sourceId` relative to `targetId`. Craft's `move` splices the node in
 * (leaving a placeholder for the old slot until after the insert), so a plain
 * `indexOf(target)` lands the node correctly whether it moves up or down within
 * the same parent. Invalid drops (into a non-canvas, into self) throw → ignored.
 */
const moveLayer = (
  query: EditorQuery,
  actions: EditorActions,
  sourceId: string,
  targetId: string,
  region: DropRegion,
): void => {
  try {
    if (region === "inside") {
      const parentNodes = query.node(targetId).get().data.nodes ?? [];
      actions.move(sourceId, targetId, parentNodes.length);
      return;
    }
    const parent = query.node(targetId).get().data.parent;
    if (!parent) return;
    const siblings = query.node(parent).get().data.nodes ?? [];
    const idx = siblings.indexOf(targetId);
    if (idx < 0) return;
    actions.move(sourceId, parent, region === "after" ? idx + 1 : idx);
  } catch {
    /* Craft rejects illegal moves (rules / descendant) — silently ignore. */
  }
};

const LayerNode: React.FC<{
  nodeId: string;
  depth: number;
  selectedId: string | null;
  filter?: string;
  onSelect: (id: string) => void;
}> = React.memo(({ nodeId, depth, selectedId, filter = "", onSelect }) => {
  const drag = React.useContext(LayerDragContext);
  const { setName, setLocked, setColorLabel } = useLayerMeta();

  // Subscribe to just this node so rename / hide / lock / child changes re-render
  // the row instantly (keeps the panel in lock-step with the Craft tree).
  const { exists, name, rawName, children, hidden, locked, isCanvas, actions, colorLabel } = useEditor(
    (state) => {
      const node = state.nodes[nodeId];
      if (!node) {
        return {
          exists: false,
          name: "",
          rawName: "",
          children: [] as string[],
          hidden: false,
        locked: false,
        isCanvas: false,
        colorLabel: undefined as string | undefined,
      };
      }
      return {
        exists: true,
        name: resolveLayerName(node),
        rawName: node.data.displayName || node.data.name || "",
        children: collectChildren(node),
        hidden: node.data.hidden === true,
        locked: isLayerLocked(node),
        isCanvas: node.data.isCanvas === true,
        colorLabel: readLayerMeta(node.data.custom).colorLabel,
      };
    },
  );

  const [open, setOpen] = React.useState(true);
  const [renaming, setRenaming] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");

  React.useEffect(() => {
    if (drag?.forceOpen != null) setOpen(drag.forceOpen);
  }, [drag?.expandSignal, drag?.forceOpen]);

  if (!exists) return null;

  const selfMatch =
    !filter ||
    name.toLowerCase().includes(filter) ||
    rawName.toLowerCase().includes(filter);

  const hasChildren = children.length > 0;
  const isSelected = selectedId === nodeId;

  // Skip the synthetic CanvasSlot wrapper — render its children inline.
  if (rawName === "CanvasSlot") {
    return (
      <>
        {children.map((c) => (
          <LayerNode
            key={c}
            nodeId={c}
            depth={depth}
            selectedId={selectedId}
            filter={filter}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  if (!selfMatch && !hasChildren) return null;

  const dropTarget = drag?.dropTarget;
  const isDropTarget = dropTarget?.id === nodeId;
  const beingDragged = drag?.dragId === nodeId;

  const commitRename = (): void => {
    setName(nodeId, draftName);
    setRenaming(false);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    if (!drag?.dragId || drag.dragId === nodeId) return;
    // Can't drop a node inside its own subtree.
    if (drag.isDescendant(drag.dragId, nodeId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const third = rect.height / 3;
    let region: DropRegion;
    if (isCanvas && offset > third && offset < third * 2) region = "inside";
    else region = offset < rect.height / 2 ? "before" : "after";
    if (dropTarget?.id !== nodeId || dropTarget.region !== region) {
      drag.setDropTarget({ id: nodeId, region });
    }
  };

  return (
    <div>
      {selfMatch ? (
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded-sm py-1 pr-1 text-xs",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent",
          hidden && "opacity-50",
          beingDragged && "opacity-40",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
        draggable={!locked && !renaming}
        onDragStart={(e) => {
          if (locked) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", nodeId);
          drag?.setDragId(nodeId);
        }}
        onDragEnd={() => {
          drag?.setDragId(null);
          drag?.setDropTarget(null);
        }}
        onDragOver={handleDragOver}
        onDragLeave={() => {
          if (drag?.dropTarget?.id === nodeId) drag.setDropTarget(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dropTarget?.id === nodeId) drag?.onDrop(nodeId, dropTarget.region);
        }}
      >
        {/* Drop indicators */}
        {isDropTarget && dropTarget?.region === "before" && (
          <span className="pointer-events-none absolute inset-x-1 top-0 h-0.5 rounded bg-primary" />
        )}
        {isDropTarget && dropTarget?.region === "after" && (
          <span className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded bg-primary" />
        )}
        {isDropTarget && dropTarget?.region === "inside" && (
          <span className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-primary" />
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" />
        )}

        <button
          type="button"
          title="Color label"
          aria-label="Set layer color label"
          onClick={(e) => {
            e.stopPropagation();
            const idx = colorLabel ? LAYER_COLORS.indexOf(colorLabel) + 1 : 0;
            setColorLabel(nodeId, LAYER_COLORS[idx % LAYER_COLORS.length] ?? null);
          }}
          className="h-3 w-3 shrink-0 rounded-full border border-border"
          style={{ background: colorLabel ?? "transparent" }}
        />

        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded-sm border border-primary bg-background px-1 py-0.5 text-xs outline-none"
          />
        ) : (
          <span
            className="min-w-0 flex-1 cursor-pointer truncate"
            onClick={() => onSelect(nodeId)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraftName(name);
              setRenaming(true);
            }}
            title="Double-click to rename"
          >
            {name}
          </span>
        )}

        {/* Actions — always shown when active, otherwise revealed on hover. */}
        <button
          type="button"
          title={locked ? "Unlock" : "Lock"}
          onClick={(e) => {
            e.stopPropagation();
            setLocked(nodeId, !locked);
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted",
            !locked && "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
        >
          {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
        <button
          type="button"
          title={hidden ? "Show" : "Hide"}
          onClick={(e) => {
            e.stopPropagation();
            actions.setHidden(nodeId, !hidden);
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted",
            !hidden && "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
        >
          {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      </div>
      ) : null}

      {open &&
        children.map((c) => (
          <LayerNode
            key={c}
            nodeId={c}
            depth={depth + 1}
            selectedId={selectedId}
            filter={filter}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
});
LayerNode.displayName = "LayerNode";
