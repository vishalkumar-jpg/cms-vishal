import * as React from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Switch, Label } from "@/components/ui";
import { useNodeGuardrails, useSetGuardrails, useCanDesign } from "./useGuardrails";

/**
 * Designer-only affordance (site_admin+) for defining brand guardrails on the
 * selected node: lock it, force token-only colors, and toggle which content
 * props contributors may edit. Contributors never see this panel — they only
 * experience the enforced result. Renders inside the property panel.
 */
export const GuardrailsControls: React.FC<{
  nodeId: string;
  /** Top-level content prop names (for the per-prop allow/lock toggles). */
  propNames: string[];
}> = ({ nodeId, propNames }) => {
  const canDesign = useCanDesign();
  const g = useNodeGuardrails(nodeId);
  const setG = useSetGuardrails(nodeId);

  if (!canDesign) {
    // Contributor view: just surface that the block is brand-managed.
    if (!g.locked && !g.colorsTokenOnly && !(g.lockedProps?.length || g.editableProps?.length)) {
      return null;
    }
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <ShieldCheck className="h-3.5 w-3.5" />
        Brand-managed block — some controls are locked to stay on-brand.
      </div>
    );
  }

  const lockedProps = new Set(g.lockedProps ?? []);
  const toggleLockedProp = (name: string, locked: boolean): void => {
    const next = new Set(lockedProps);
    if (locked) next.add(name);
    else next.delete(name);
    setG({ ...g, lockedProps: [...next] });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
      <div className="flex items-center gap-1.5 font-semibold">
        <Lock className="h-3.5 w-3.5" /> Brand guardrails
      </div>
      <p className="text-[11px] text-muted-foreground">
        Lock this block or restrict what contributors can change. You (admin) are never constrained.
      </p>

      <label className="flex items-center justify-between">
        <span>Lock block (no move / delete / drag)</span>
        <Switch
          checked={!!g.locked}
          onCheckedChange={(c) => setG({ ...g, locked: c })}
        />
      </label>

      <label className="flex items-center justify-between">
        <span>Colors: theme tokens only</span>
        <Switch
          checked={!!g.colorsTokenOnly}
          onCheckedChange={(c) => setG({ ...g, colorsTokenOnly: c })}
        />
      </label>

      {propNames.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Lock specific content props</p>
          {propNames.map((name) => (
            <label key={name} className="flex items-center justify-between">
              <Label className="font-normal">{name}</Label>
              <Switch
                checked={lockedProps.has(name)}
                onCheckedChange={(c) => toggleLockedProp(name, c)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
