import * as React from "react";
import { LayoutGrid, Box, Layers, UnfoldVertical } from "lucide-react";
import type { WrapType } from "../craft/nodeOps";
import type { NodeActions } from "../hooks/useNodeActions";

const WRAP_OPTIONS: { type: WrapType; label: string; icon: React.ReactNode }[] = [
  { type: "Section", label: "Section", icon: <Layers className="h-3.5 w-3.5" /> },
  { type: "Container", label: "Container", icon: <Box className="h-3.5 w-3.5" /> },
  { type: "Grid", label: "Grid", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
];

/** Context-menu rows for wrap / unwrap. */
export const WrapContextMenuItems: React.FC<{
  nodeId: string;
  actions: NodeActions;
  onRun: (fn: () => void) => (e: React.MouseEvent) => void;
}> = ({ nodeId, actions, onRun }) => {
  const canWrap = actions.canWrap(nodeId);
  const canUnwrap = actions.canUnwrap(nodeId);
  if (!canWrap && !canUnwrap) return null;

  return (
    <>
      <div className="my-1 h-px bg-border" />
      <p className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Wrap
      </p>
      {WRAP_OPTIONS.map((opt) => (
        <button
          key={opt.type}
          type="button"
          disabled={!canWrap}
          onClick={onRun(() => actions.wrap(nodeId, opt.type))}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
        >
          {opt.icon}
          Wrap in {opt.label}
        </button>
      ))}
      <button
        type="button"
        disabled={!canUnwrap}
        onClick={onRun(() => actions.unwrap(nodeId))}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
      >
        <UnfoldVertical className="h-3.5 w-3.5" />
        Unwrap
      </button>
    </>
  );
};

/** Compact wrap dropdown for the inline toolbar. */
export const WrapToolbarMenu: React.FC<{
  nodeId: string;
  actions: NodeActions;
  disabled?: boolean;
}> = ({ nodeId, actions, disabled }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const canWrap = actions.canWrap(nodeId);
  const canUnwrap = actions.canUnwrap(nodeId);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (!canWrap && !canUnwrap) return null;

  const run = (fn: () => void) => (): void => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Wrap / unwrap"
        aria-label="Wrap or unwrap"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 items-center gap-0.5 rounded px-1 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
      >
        <Layers className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[9rem] overflow-hidden rounded-md border border-border bg-card p-1 shadow-md">
          {WRAP_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              disabled={!canWrap}
              onClick={run(() => actions.wrap(nodeId, opt.type))}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
          <div className="my-0.5 h-px bg-border" />
          <button
            type="button"
            disabled={!canUnwrap}
            onClick={run(() => actions.unwrap(nodeId))}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
          >
            <UnfoldVertical className="h-3.5 w-3.5" />
            Unwrap
          </button>
        </div>
      )}
    </div>
  );
};
