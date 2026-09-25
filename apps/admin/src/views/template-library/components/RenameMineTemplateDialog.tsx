import * as React from "react";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TemplateLibraryMineItem } from "../types";

export type RenameMineTemplateDialogProps = {
  item: TemplateLibraryMineItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (item: TemplateLibraryMineItem, name: string) => Promise<void>;
  isPending?: boolean;
};

/** Rename a site-owned My Template from the library. */
export const RenameMineTemplateDialog: React.FC<RenameMineTemplateDialogProps> = ({
  item,
  open,
  onOpenChange,
  onRename,
  isPending,
}) => {
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    if (open && item) setName(item.title);
  }, [open, item]);

  const submit = async (): Promise<void> => {
    if (!item) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.title) {
      onOpenChange(false);
      return;
    }
    try {
      await onRename(item, trimmed);
      onOpenChange(false);
    } catch {
      // Parent handles toast; keep dialog open so the user can retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename My Template</DialogTitle>
          <DialogDescription>
            Update the display name for this saved layout. Existing pages are not changed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mine-template-rename">Template name</Label>
          <Input
            id="mine-template-rename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!item || !name.trim() || isPending}
          >
            {isPending ? "Saving…" : "Save name"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
