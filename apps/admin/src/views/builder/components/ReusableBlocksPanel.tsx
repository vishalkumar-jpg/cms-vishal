import * as React from "react";
import { useEditor, type NodeTree } from "@craftjs/core";
import { Plus, GripVertical, Pencil } from "lucide-react";
import { useNavigate } from "react-router";
import { layoutHasContent } from "@ob-cms/block-schema";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useReusableBlocks } from "@/views/reusable-blocks/hooks/useReusableBlocks";
import { useReusableBlockInsert } from "../hooks/useReusableBlockInsert";
import type { ReusableBlock } from "@/views/reusable-blocks/types";

/**
 * Reusable-blocks panel: lists the site's reusable / global synced blocks and
 * inserts a REFERENCE to one (a single `ReusableBlock` node carrying
 * `reusableBlockId`). Editing the source later updates EVERY instance — distinct
 * from templates, which copy. Each item is also a Craft drag source.
 */
export const ReusableBlocksPanel: React.FC<{ siteId: string | null }> = ({ siteId }) => {
  const { data: blocks = [], isLoading } = useReusableBlocks(siteId);
  const { connectors } = useEditor();
  const navigate = useNavigate();
  const { makeDragTree, insert, focusInsertedNode } = useReusableBlockInsert();

  if (!siteId) return <p className="p-4 text-xs text-muted-foreground">Select a site first.</p>;

  return (
    <div className="flex flex-col gap-2 p-3">
      {isLoading && <p className="text-xs text-muted-foreground">Loading reusable blocks…</p>}
      {!isLoading && blocks.length > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Drag onto the page between sections, use the orange + on the canvas for a specific
          position, or click + here to insert after your selection. Blocks marked{" "}
          <span className="font-semibold text-amber-700 dark:text-amber-300">Empty</span> need
          content in the reusable editor first.
        </p>
      )}
      {!isLoading && blocks.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No reusable blocks yet. Select a block and use “Save as reusable block”, or create one
          from Reusable Blocks → New reusable block.
        </p>
      )}
      {blocks.map((b) => (
        <ReusableBlockRow
          key={b.id}
          block={b}
          connectors={connectors}
          makeDragTree={makeDragTree}
          onInsert={() => {
            if (!layoutHasContent(b.layout)) {
              toast.warning(
                `“${b.name}” is empty. Add sections in the reusable editor, then save.`,
              );
            }
            insert(b.id);
          }}
          onEdit={() => navigate(`/reusable/${b.id}`)}
          onCreated={focusInsertedNode}
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        className="mt-1"
        onClick={() => navigate("/reusable")}
      >
        Manage reusable blocks
      </Button>
    </div>
  );
};

const ReusableBlockRow: React.FC<{
  block: ReusableBlock;
  connectors: ReturnType<typeof useEditor>["connectors"];
  makeDragTree: (id: string) => NodeTree | null;
  onInsert: () => void;
  onEdit: () => void;
  onCreated: (nodeId: string) => void;
}> = ({ block, connectors, makeDragTree, onInsert, onEdit, onCreated }) => {
  const empty = !layoutHasContent(block.layout);
  const attachDrag = React.useCallback(
    (ref: HTMLDivElement | null): void => {
      if (!ref) return;
      connectors.create(
        ref,
        () => {
          const tree = makeDragTree(block.id);
          if (!tree) throw new Error("Reusable Block is not registered");
          return tree;
        },
        {
          onCreate: (tree) => onCreated(tree.rootNodeId),
        },
      );
    },
    [block.id, connectors, makeDragTree, onCreated],
  );

  return (
    <div className="flex items-center rounded-md border border-border bg-card">
      <div
        ref={attachDrag}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 p-2 active:cursor-grabbing"
        title={`Drag “${block.name}” onto the canvas`}
        onDoubleClick={onEdit}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">{block.name}</span>
        {empty ? (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Empty
          </span>
        ) : null}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        title={`Edit “${block.name}”`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        title="Insert reference"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onInsert();
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
