import * as React from "react";
import { LayoutTemplate } from "lucide-react";
import { Button, Input, Label, Switch } from "@/components/ui";
import { useComponentEditor } from "./ComponentEditorContext";
import { useNodeComponent, useSetSlot } from "./useComponentNode";

/**
 * COMPONENTS — "mark as Slot" control, shown ONLY in the component editor. A slot
 * node is a named editable region: an instance can replace its children with its
 * own `slotContent[name]` (else the slot's default children render). Stored as
 * `isSlot` + `slotName` on the node (Craft `custom`, hoisted on save).
 *
 * Outside the component editor this renders nothing (backward-compatible).
 */
export const SlotMarkerControl: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const editor = useComponentEditor();
  const { isSlot, slotName } = useNodeComponent(nodeId);
  const setSlot = useSetSlot(nodeId);
  const [draft, setDraft] = React.useState(slotName ?? "");

  React.useEffect(() => setDraft(slotName ?? ""), [slotName, nodeId]);

  if (!editor) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs">
          <LayoutTemplate className="h-3.5 w-3.5" /> Editable Slot
        </Label>
        <Switch
          checked={!!isSlot}
          onCheckedChange={(c) => setSlot(c ? draft || "slot" : undefined)}
        />
      </div>
      {isSlot ? (
        <div className="flex items-center gap-1.5">
          <Input
            className="h-7 text-xs"
            value={draft}
            placeholder="Slot name (e.g. body)"
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!draft.trim() || draft === slotName}
            onClick={() => setSlot(draft.trim())}
          >
            Save
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Mark this block as a named region instances can fill with their own content.
        </p>
      )}
    </div>
  );
};
