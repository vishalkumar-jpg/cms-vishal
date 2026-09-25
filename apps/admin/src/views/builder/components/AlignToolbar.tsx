import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { alignNodes, distributeNodes, type AlignKind, type DistributeKind } from "../overlay/align";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Align / distribute controls for multi-selection — uses margin nudging via align.ts.
 */
export const AlignToolbar: React.FC = React.memo(() => {
  const { query, actions } = useEditor();
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const extraSelected = useEditorUiStore((s) => s.extraSelected);
  const { primaryId } = useEditor((_, q) => {
    const sel = q.getEvent("selected").all();
    return { primaryId: sel.length ? sel[sel.length - 1] : null };
  });

  const ids = React.useMemo(() => {
    if (!primaryId) return [];
    const set = new Set([primaryId, ...extraSelected]);
    return [...set];
  }, [primaryId, extraSelected]);

  if (ids.length < 2) return null;

  const runAlign = (kind: AlignKind): void => alignNodes(query, actions, ids, kind, breakpoint);
  const runDist = (kind: DistributeKind): void =>
    distributeNodes(query, actions, ids, kind, breakpoint);

  const Btn: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({
    label,
    onClick,
    children,
  }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[58] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-card px-2 py-1 shadow-lg"
      role="toolbar"
      aria-label="Align selection"
    >
      <span className="mr-1 text-[10px] font-medium text-muted-foreground">{ids.length} selected</span>
      <Btn label="Align left" onClick={() => runAlign("left")}>
        <AlignLeft className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Align center horizontally" onClick={() => runAlign("hcenter")}>
        <AlignCenter className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Align right" onClick={() => runAlign("right")}>
        <AlignRight className="h-3.5 w-3.5" />
      </Btn>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <Btn label="Align top" onClick={() => runAlign("top")}>
        <AlignVerticalJustifyStart className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Align middle vertically" onClick={() => runAlign("vmiddle")}>
        <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Align bottom" onClick={() => runAlign("bottom")}>
        <AlignVerticalJustifyEnd className="h-3.5 w-3.5" />
      </Btn>
      {ids.length >= 3 && (
        <>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <Btn label="Distribute horizontally" onClick={() => runDist("horizontal")}>
            <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
          </Btn>
          <Btn label="Distribute vertically" onClick={() => runDist("vertical")}>
            <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
          </Btn>
        </>
      )}
    </div>
  );
});
AlignToolbar.displayName = "AlignToolbar";
