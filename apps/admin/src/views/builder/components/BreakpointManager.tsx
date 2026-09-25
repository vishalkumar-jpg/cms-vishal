import * as React from "react";
import { Button, Input, Label } from "@/components/ui";
import { useEditorUiStore, BREAKPOINT_WIDTH } from "../store/editorUiStore";
import type { Breakpoint } from "../property/styleTokens";

interface BreakpointManagerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const EDITABLE: Breakpoint[] = ["largeDesktop", "laptop", "tablet", "mobile"];

/** Custom canvas preview widths for each device breakpoint. */
export const BreakpointManager: React.FC<BreakpointManagerProps> = ({ open, onOpenChange }) => {
  const custom = useEditorUiStore((s) => s.customBreakpointWidths);
  const setWidth = useEditorUiStore((s) => s.setCustomBreakpointWidth);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="bp-manager-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 id="bp-manager-title" className="text-sm font-semibold">
            Custom preview widths
          </h3>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Override default canvas widths for device previews. Desktop stays full width.
        </p>
        <ul className="space-y-3">
          {EDITABLE.map((bp) => {
            const def = BREAKPOINT_WIDTH[bp];
            const val = custom[bp] ?? def ?? "";
            return (
              <li key={bp} className="flex items-center gap-3">
                <Label className="w-28 shrink-0 capitalize text-xs">{bp.replace(/([A-Z])/g, " $1")}</Label>
                <Input
                  type="number"
                  min={280}
                  max={2560}
                  className="h-8 flex-1 text-xs"
                  placeholder={def ? String(def) : "Full width"}
                  value={val === null || val === undefined ? "" : String(val)}
                  onChange={(e) => {
                    const n = e.target.value === "" ? null : Number(e.target.value);
                    setWidth(bp, n != null && !Number.isNaN(n) ? n : null);
                  }}
                />
                <span className="text-[10px] text-muted-foreground">px</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
