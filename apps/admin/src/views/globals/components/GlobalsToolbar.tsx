import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Save,
  ArrowLeft,
  Check,
  Loader2,
  CircleAlert,
  PanelTop,
  PanelBottom,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import type { Breakpoint } from "@/views/builder/property/styleTokens";
import type { SaveState } from "@/views/builder/hooks/useAutosave";
import type { ChromeSlot } from "../api/globals.api";

interface GlobalsToolbarProps {
  slot: ChromeSlot;
  saveState: SaveState;
  onBack: () => void;
  onSave: () => void;
  onSwitchSlot: (slot: ChromeSlot) => void;
}

const BREAKPOINTS: { key: Breakpoint; icon: React.ReactNode; label: string }[] = [
  { key: "desktop", icon: <Monitor className="h-4 w-4" />, label: "Desktop" },
  { key: "tablet", icon: <Tablet className="h-4 w-4" />, label: "Tablet" },
  { key: "mobile", icon: <Smartphone className="h-4 w-4" />, label: "Mobile" },
];

/**
 * Toolbar for the GLOBAL-CHROME builder. Reuses the page builder's breakpoint
 * switcher + undo/redo + save indicator, but drops page-only actions
 * (Schedule/Versions/Templates/Publish — chrome is save = live). Adds a
 * Header/Footer toggle to switch which global slot is being edited.
 */
export const GlobalsToolbar: React.FC<GlobalsToolbarProps> = ({
  slot,
  saveState,
  onBack,
  onSave,
  onSwitchSlot,
}) => {
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const setBreakpoint = useEditorUiStore((s) => s.setBreakpoint);
  const { canUndo, canRedo, actions } = useEditor((_, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-sm font-semibold leading-none">Header &amp; Footer</p>
          <SaveIndicator state={saveState} />
        </div>
        {/* Slot toggle — switch between the global header and footer. */}
        <div className="ml-2 flex items-center gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            title="Edit global header"
            onClick={() => onSwitchSlot("header")}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              slot === "header"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <PanelTop className="h-3.5 w-3.5" /> Header
          </button>
          <button
            type="button"
            title="Edit global footer"
            onClick={() => onSwitchSlot("footer")}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              slot === "footer"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <PanelBottom className="h-3.5 w-3.5" /> Footer
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border p-1">
        {BREAKPOINTS.map((bp) => (
          <button
            key={bp.key}
            type="button"
            title={bp.label}
            onClick={() => setBreakpoint(bp.key)}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
              breakpoint === bp.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {bp.icon}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canUndo}
          onClick={() => actions.history.undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canRedo}
          onClick={() => actions.history.redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button size="sm" onClick={onSave}>
          <Save className="mr-1.5 h-4 w-4" /> Save
        </Button>
      </div>
    </header>
  );
};

const SaveIndicator: React.FC<{ state: SaveState }> = ({ state }) => {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-600">
        <Check className="h-3 w-3" /> Saved (live)
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1 text-[11px] text-destructive">
        <CircleAlert className="h-3 w-3" /> Save failed
      </span>
    );
  return <span className="text-[11px] text-muted-foreground">Edits save automatically</span>;
};
