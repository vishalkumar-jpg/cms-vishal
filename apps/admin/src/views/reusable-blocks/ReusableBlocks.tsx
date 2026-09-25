import * as React from "react";
import { useNavigate } from "react-router";
import { Layers, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useSiteStore } from "@/store/siteStore";
import { createEmptyReusableBlockLayout } from "@/views/builder/craft/fragmentEditorLayout";
import { useReusableBlocks, useDeleteReusableBlock, useCreateReusableBlock } from "./hooks/useReusableBlocks";
import type { ReusableBlock } from "./types";

/**
 * REUSE-BLOCKS manager — lists the site's reusable / global synced blocks with
 * edit (opens the source builder) and delete. New blocks are created from the
 * page builder via "Save as reusable block"; editing the source here updates
 * EVERY instance ("edit once, update everywhere").
 */
export const ReusableBlocks: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const navigate = useNavigate();
  const { data: blocks = [], isLoading, isError } = useReusableBlocks(siteId);
  const del = useDeleteReusableBlock(siteId);
  const create = useCreateReusableBlock(siteId);
  const confirm = useConfirm();

  const doDelete = (block: ReusableBlock): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${block.name}"?`,
        description:
          "This reusable block and all page references will be removed. This action cannot be undone.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(block.id, {
        onSuccess: () => toast.success("Reusable block deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  const onCreateBlank = async (): Promise<void> => {
    if (!siteId) return;
    try {
      const block = await create.mutateAsync({
        name: "Untitled block",
        layout: createEmptyReusableBlockLayout(),
      });
      navigate(`/reusable/${block.id}`);
    } catch {
      toast.error("Could not create reusable block");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reusable Blocks</h1>
          <p className="text-sm text-muted-foreground">
            Named, synced blocks for this site. Insert them on pages as references —
            editing the source here updates every instance. Create one from scratch
            or from the page builder with “Save as reusable block”.
          </p>
        </div>
        <Button onClick={() => void onCreateBlank()} disabled={!siteId || create.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          New reusable block
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow text="Select a site to view its reusable blocks." />}
            {siteId && isLoading && <EmptyRow text="Loading reusable blocks…" />}
            {siteId && isError && <EmptyRow text="Could not load reusable blocks." />}
            {siteId && !isLoading && !isError && blocks.length === 0 && (
              <EmptyRow text="No reusable blocks yet. Use “Save as reusable block” in the builder." />
            )}
            {blocks.map((b) => (
              <Row
                key={b.id}
                block={b}
                onEdit={() => navigate(`/reusable/${b.id}`)}
                onDelete={() => doDelete(b)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <tr>
    <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
      <Layers className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {text}
    </td>
  </tr>
);

const Row: React.FC<{
  block: ReusableBlock;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ block, onEdit, onDelete }) => (
  <tr className="hover:bg-muted/30">
    <td className="cursor-pointer px-4 py-3 font-medium" onClick={onEdit}>
      {block.name}
    </td>
    <td className="px-4 py-3 text-muted-foreground">
      {new Date(block.updatedAt).toLocaleDateString()}
    </td>
    <td className="px-4 py-3 text-right">
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit source" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </td>
  </tr>
);
