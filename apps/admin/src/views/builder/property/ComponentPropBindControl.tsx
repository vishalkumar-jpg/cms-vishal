import * as React from "react";
import { Settings2, Unlink } from "lucide-react";
import { Button, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ComponentBinding } from "@ob-cms/block-schema";
import { useComponentEditor } from "./ComponentEditorContext";
import { useNodeComponent, useSetComponentBinding } from "./useComponentNode";

/**
 * COMPONENTS — the "⚙ use prop" affordance next to a node prop, shown ONLY in the
 * component (reusable-block) editor (when `ComponentEditorContext` is present)
 * and only once the component declares at least one prop. Toggling it on binds
 * the node prop to a component prop key via `componentBinding[propName]`; at
 * instance render the bound prop takes the instance's merged prop value
 * (default → variant → override). Mirrors the data-binding FieldBindControl.
 *
 * Outside the component editor this renders nothing, so ordinary page props are
 * unaffected (backward-compatible).
 */
export const ComponentPropBindControl: React.FC<{
  nodeId: string;
  propName: string;
}> = ({ nodeId, propName }) => {
  const editor = useComponentEditor();
  const { componentBinding = {} } = useNodeComponent(nodeId);
  const setBinding = useSetComponentBinding(nodeId);

  // Only available in the component editor with declared props to bind to.
  if (!editor || editor.props.length === 0) return null;

  const boundTo = componentBinding[propName];
  const isBound = !!boundTo;

  const setBoundKey = (key: string | undefined): void => {
    const next: ComponentBinding = { ...componentBinding };
    if (!key) delete next[propName];
    else next[propName] = key;
    setBinding(next);
  };

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <Button
        type="button"
        size="icon"
        variant={isBound ? "default" : "outline"}
        className="h-7 w-7 shrink-0"
        title={isBound ? "Unbind from component prop" : "Use a component prop"}
        onClick={() => setBoundKey(isBound ? undefined : editor.props[0]?.key)}
      >
        {isBound ? <Unlink className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
      </Button>
      {isBound ? (
        <Select value={boundTo} onValueChange={(v) => setBoundKey(v)}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue placeholder="Pick a prop…" />
          </SelectTrigger>
          <SelectContent>
            {editor.props.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label || p.key}
                <span className="text-muted-foreground"> ({p.type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Label className="text-[11px] text-muted-foreground">Use component prop</Label>
      )}
    </div>
  );
};
