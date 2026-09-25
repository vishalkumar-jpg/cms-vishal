import * as React from "react";
import { useSelectionContext } from "./useSelectionContext";
import { useOverlayMeasure } from "./useOverlayMeasure";
import { OverlayDragContext, type DragFeedback } from "./dragContext";
import { ResizeHandles } from "./ResizeHandles";
import { SpacingBands } from "./SpacingBands";
import { GuideLayer } from "./GuideLayer";
import { DropIndicator } from "./DropIndicator";
import { DragSnapGuides } from "./DragSnapGuides";
import { SubPartOverlay } from "./SubPartOverlay";
import { useNodeActions } from "../hooks/useNodeActions";
import { useEnforcedGuardrails, isPropEditable } from "../guardrails/useGuardrails";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * The builder's direct-manipulation overlay stack. Mounted once inside
 * `<Editor>` (via BuilderShell) as a fixed-position layer that never
 * participates in canvas layout — so handles, guides and drop indicators
 * track the selected node without causing layout jumps or re-mount flicker.
 *
 * Sub-components return `null` when there's nothing to show (no selection,
 * root node, locked node, etc.) but this shell stays mounted so the drag
 * context and measure loop remain stable across selection changes.
 */
export const OverlayLayer: React.FC = () => {
  const ctx = useSelectionContext();
  const confirmOpen = useEditorUiStore((s) => s.modalDialogOpen);
  const nodeActions = useNodeActions();
  const enforced = useEnforcedGuardrails(ctx.id);
  // DUAL-MODE — direct-manipulation chrome (resize handles, spacing bands, snap
  // guides) is Structure-mode only. Content mode keeps selection + inline edits.
  const structureMode = useEditorUiStore((s) => s.editMode === "structure");

  // Re-measure whenever the tracked DOM nodes move/resize or props change.
  const watched = React.useMemo(
    () => [ctx.dom, ctx.parentDom, ...ctx.siblingDoms],
    [ctx.dom, ctx.parentDom, ctx.siblingDoms],
  );
  const measureTick = useOverlayMeasure(watched, [ctx.id, ctx.styles]);

  // Shared drag state — resize/spacing gestures publish guides here.
  const [dragActive, setDragActive] = React.useState(false);
  const [feedback, setFeedbackState] = React.useState<DragFeedback>({
    guides: [],
    badges: [],
  });

  // Stable, idempotent publisher. Clearing an already-empty feedback must NOT
  // create a new object — otherwise the context value changes on every render,
  // re-triggering consumers' effects that clear it again (infinite setState loop
  // → "Maximum update depth exceeded", seen when selecting a button/link).
  const setFeedback = React.useCallback((f: DragFeedback) => {
    setFeedbackState((prev) =>
      prev.guides.length === 0 &&
      prev.badges.length === 0 &&
      f.guides.length === 0 &&
      f.badges.length === 0
        ? prev
        : f,
    );
  }, []);

  const dragValue = React.useMemo(
    () => ({
      active: dragActive,
      feedback,
      setActive: setDragActive,
      setFeedback,
    }),
    [dragActive, feedback, setFeedback],
  );

  const locked = ctx.id ? nodeActions.isLocked(ctx.id) : false;
  const isNavbar = ctx.displayName === "Navbar";
  const canResizeWidth = !isNavbar && isPropEditable(enforced, "styles.sizing.width");
  const canResizeHeight = !isNavbar && isPropEditable(enforced, "styles.sizing.height");
  const showSelectionOverlays = structureMode && !confirmOpen && !!ctx.id && !ctx.isRoot && !locked;
  const showResize =
    showSelectionOverlays && (canResizeWidth || canResizeHeight);

  return (
    <OverlayDragContext.Provider value={dragValue}>
      {/* Drop indicator: insertion line + container highlight during palette/block drag. */}
      <DropIndicator />

      {/* Snap guides + distance badges while reordering an existing block. */}
      <DragSnapGuides />

      {/* Sub-part hover + selection highlight (title/image/button inside blocks). */}
      <SubPartOverlay />

      {showSelectionOverlays && (
        <SpacingBands ctx={ctx} measureTick={measureTick} />
      )}

      {showResize && (
        <ResizeHandles
          ctx={ctx}
          measureTick={measureTick}
          canResizeWidth={canResizeWidth}
          canResizeHeight={canResizeHeight}
        />
      )}

      {/* Magenta alignment guides + px distance badges (resize / block drag). */}
      <GuideLayer guides={feedback.guides} badges={feedback.badges} />
    </OverlayDragContext.Provider>
  );
};
