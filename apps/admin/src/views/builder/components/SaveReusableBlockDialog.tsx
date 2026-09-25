import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import { useCreateReusableBlock } from "@/views/reusable-blocks/hooks/useReusableBlocks";
import { lockModalDialogChrome, unlockModalDialogChrome } from "@/components/ui/confirm-provider";
import { subtreeToLayout } from "../craft/nodeOps";

/**
 * Save the SELECTED block subtree as a reusable / global synced block
 * (REUSE-BLOCKS). The fragment is serialized rooted at the selected node and
 * POSTed to create a reusable block; pages can then insert a REFERENCE to it
 * (editing the source updates every instance).
 */
export const SaveReusableBlockDialog: React.FC<{
  selectedId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ selectedId, open, onOpenChange }) => {
  const [name, setName] = React.useState("");
  const { query } = useEditor();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const create = useCreateReusableBlock(siteId);

  React.useEffect(() => {
    if (!open) return;
    // Keep the selected node so PropertyPanel + subtree serialization stay valid.
    lockModalDialogChrome({ clearSelection: false });
    return () => unlockModalDialogChrome();
  }, [open]);

  const onSave = async (): Promise<void> => {
    if (!name.trim() || !selectedId) return;
    const layout = subtreeToLayout(query, selectedId);
    try {
      await create.mutateAsync({ name: name.trim(), layout });
      toast.success("Reusable block saved");
      setName("");
      onOpenChange(false);
    } catch {
      toast.error("Could not save reusable block");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as reusable block</DialogTitle>
          <DialogDescription>
            Save this block as a reusable, synced block for this site. Inserting it
            on pages creates references — editing the source updates every instance.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reusable-name">Block name</Label>
          <Input
            id="reusable-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Promo banner"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} disabled={!name.trim() || create.isPending}>
            Save block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
