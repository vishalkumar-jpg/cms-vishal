import * as React from "react";
import { useNavigate } from "react-router";
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
import { useCreateTemplate } from "@/views/templates/hooks/useTemplates";
import {
  MY_TEMPLATES_TAB_LABEL,
  SAVE_AS_MY_TEMPLATE_LABEL,
  SAVE_TO_MY_TEMPLATES_LABEL,
  SAVED_TO_MY_TEMPLATES_TOAST,
  STARTER_TEMPLATES_TAB_LABEL,
  VIEW_IN_MY_TEMPLATES_LABEL,
} from "@/views/template-library/constants";
import { selectionToSectionTemplateLayout } from "../craft/nodeOps";
import { craftToLayout } from "../craft/serialize";

/**
 * Save the current page (or selection) as a reusable template. If a node is
 * selected, the template is just that subtree; otherwise the whole page.
 */
export const SaveTemplateDialog: React.FC<{
  siteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ siteId, open, onOpenChange }) => {
  const [name, setName] = React.useState("");
  const [justSaved, setJustSaved] = React.useState(false);
  const navigate = useNavigate();
  const { query } = useEditor();
  const create = useCreateTemplate(siteId);

  React.useEffect(() => {
    if (!open) {
      setJustSaved(false);
      setName("");
    }
  }, [open]);

  const onSave = async (): Promise<void> => {
    if (!name.trim()) return;
    const selected = query.getEvent("selected").all();
    const selectedId = selected.length === 1 ? selected[0] : null;
    const isSection = Boolean(selectedId && selectedId !== "ROOT");
    const layout = isSection
      ? selectionToSectionTemplateLayout(query, selectedId!)
      : craftToLayout(query.serialize());
    try {
      await create.mutateAsync({
        name: name.trim(),
        layout,
        kind: isSection ? "section" : "page",
      });
      toast.success(SAVED_TO_MY_TEMPLATES_TOAST);
      setJustSaved(true);
      setName("");
    } catch {
      toast.error("Could not save My Template");
    }
  };

  const viewInLibrary = (): void => {
    onOpenChange(false);
    void navigate("/template-library?tab=mine");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{SAVE_AS_MY_TEMPLATE_LABEL}</DialogTitle>
          <DialogDescription>
            Save this page layout to {MY_TEMPLATES_TAB_LABEL} for this site. This does not change
            platform {STARTER_TEMPLATES_TAB_LABEL}.
          </DialogDescription>
        </DialogHeader>
        {justSaved ? (
          <p className="text-sm text-muted-foreground">
            Your template was saved. Open the library to manage or insert it from the builder sidebar.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Landing hero + features"
              autoFocus
            />
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {justSaved ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              <Button type="button" onClick={viewInLibrary}>
                {VIEW_IN_MY_TEMPLATES_LABEL}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void onSave()} disabled={!name.trim() || create.isPending}>
                {SAVE_TO_MY_TEMPLATES_LABEL}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
