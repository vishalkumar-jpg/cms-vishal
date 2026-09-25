import * as React from "react";
import { Link2, Link2Off } from "lucide-react";
import { Button, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Bindings } from "@ob-cms/block-schema";
import {
  useBindableFields,
  useNodeDynamic,
  useSetBindings,
} from "./useNodeBinding";

/**
 * The "⛓ bind" affordance shown next to a bindable prop (text/url/image) when
 * bindable collection fields are available — either from the Collection Detail
 * Builder context (layout root) or from an ancestor Repeater. Toggling it on lets
 * the author pick a field; the prop's published value then becomes that field's
 * value per item. Stored on the node's `bindings[propPath]` (Craft `custom`,
 * hoisted on save).
 *
 * When no bindable fields apply, this renders nothing — ordinary props are
 * unaffected (backward-compatible).
 */
export const FieldBindControl: React.FC<{
  nodeId: string;
  propName: string;
}> = ({ nodeId, propName }) => {
  const fields = useBindableFields(nodeId);
  const { bindings = {} } = useNodeDynamic(nodeId);
  const setBindings = useSetBindings(nodeId);

  // Only offer binding when there's a collection to bind to.
  if (fields.length === 0) return null;

  const boundTo = bindings[propName];
  const isBound = !!boundTo;

  const setBoundField = (fieldKey: string | undefined): void => {
    const next: Bindings = { ...bindings };
    if (!fieldKey) delete next[propName];
    else next[propName] = fieldKey;
    setBindings(next);
  };

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <Button
        type="button"
        size="icon"
        variant={isBound ? "default" : "outline"}
        className="h-7 w-7 shrink-0"
        title={isBound ? "Unbind from collection field" : "Bind to a collection field"}
        onClick={() => setBoundField(isBound ? undefined : fields[0]?.key)}
      >
        {isBound ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
      </Button>
      {isBound ? (
        <Select value={boundTo} onValueChange={(v) => setBoundField(v)}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue placeholder="Pick a field…" />
          </SelectTrigger>
          <SelectContent>
            {fields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label || f.key}
                <span className="text-muted-foreground"> ({f.type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Label className="text-[11px] text-muted-foreground">Bind to field</Label>
      )}
    </div>
  );
};
