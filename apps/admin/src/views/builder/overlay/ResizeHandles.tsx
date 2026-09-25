import * as React from "react";
import { useEditor } from "@craftjs/core";
import { useEditorUiStore } from "../store/editorUiStore";
import { writeStyles } from "./styleWrites";
import { rectOf, snapToGrid, computeSnap, distanceBadges, type Rect, type Guide } from "./geometry";
import { useRafThrottle } from "./useOverlayMeasure";
import { useOverlayDrag } from "./dragContext";
import { ValueBadge } from "./GuideLayer";
import type { SelectionContext } from "./useSelectionContext";

/** The 8 resize handles: corners + edge midpoints. */
type HandlePos = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: { pos: HandlePos; cx: number; cy: number; cursor: string }[] = [
  { pos: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
  { pos: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
  { pos: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
  { pos: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
  { pos: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
  { pos: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
  { pos: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
  { pos: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
];

const changesX = (p: HandlePos): -1 | 0 | 1 =>
  p.includes("w") ? -1 : p.includes("e") ? 1 : 0;
const changesY = (p: HandlePos): -1 | 0 | 1 =>
  p.includes("n") ? -1 : p.includes("s") ? 1 : 0;

interface DragState {
  pos: HandlePos;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  ratio: number;
  /** widths/heights of snap targets (siblings + parent content box). */
  targets: Rect[];
  /** Anchor rect (the fixed corner/edge) for guide extents. */
  anchor: Rect;
}

/**
 * Eight drag-to-resize handles on the selected node's bounding rect, with a live
 * `W × H` badge, Shift = lock aspect ratio, and snapping to a 4px grid + to
 * sibling/parent dimensions (magenta guides via the shared drag layer).
 *
 * Writes go to `styles.sizing.width` / `styles.sizing.height` (numbers, px) at
 * the active breakpoint through Craft's setProp — so autosave + undo/redo work
 * and tablet/mobile resize lands in the responsive override layer. We never touch
 * StyleControls or the StyleModel shape; we reuse the exact same paths the panel
 * writes (`sizing.width` / `sizing.height`).
 */
interface ResizeHandlesProps {
  ctx: SelectionContext;
  measureTick: number;
  /** False when guardrails lock `styles.sizing.width` for this user. */
  canResizeWidth?: boolean;
  /** False when guardrails lock `styles.sizing.height` for this user. */
  canResizeHeight?: boolean;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  ctx,
  measureTick,
  canResizeWidth = true,
  canResizeHeight = true,
}) => {
  const { actions } = useEditor();
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const { schedule } = useRafThrottle();
  const drag = useOverlayDrag();
  const [badge, setBadge] = React.useState<{ w: number; h: number; x: number; y: number } | null>(
    null,
  );
  const stateRef = React.useRef<DragState | null>(null);

  const dom = ctx.dom;
  // Re-read each render tick so the frame tracks scroll/resize/edits.
  const rect = React.useMemo<Rect | null>(
    () => (dom ? rectOf(dom) : null),
    [dom, measureTick],
  );

  if (!dom || !rect || ctx.isRoot) return null;

  // Only show handles whose axis is editable under guardrails.
  const visibleHandles = HANDLES.filter((h) => {
    const cx = changesX(h.pos);
    const cy = changesY(h.pos);
    if (cx !== 0 && !canResizeWidth) return false;
    if (cy !== 0 && !canResizeHeight) return false;
    return true;
  });
  if (visibleHandles.length === 0) return null;

  const beginDrag =
    (pos: HandlePos) =>
    (e: React.PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);

      const r = rectOf(dom);
      const targets: Rect[] = ctx.siblingDoms.map(rectOf);
      if (ctx.parentDom) targets.push(rectOf(ctx.parentDom));

      stateRef.current = {
        pos,
        startX: e.clientX,
        startY: e.clientY,
        startW: r.width,
        startH: r.height,
        ratio: r.height === 0 ? 1 : r.width / r.height,
        targets,
        anchor: r,
      };
      drag.setActive(true);
    };

  const onPointerMove = (e: React.PointerEvent): void => {
    const st = stateRef.current;
    if (!st) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const shift = e.shiftKey;

    schedule(() => {
      const cx = canResizeWidth ? changesX(st.pos) : 0;
      const cy = canResizeHeight ? changesY(st.pos) : 0;
      const dx = (clientX - st.startX) * cx;
      const dy = (clientY - st.startY) * cy;
      let w = cx !== 0 ? Math.max(8, st.startW + dx) : st.startW;
      let h = cy !== 0 ? Math.max(8, st.startH + dy) : st.startH;

      // Shift = lock aspect ratio (only when both axes are editable).
      if (shift && canResizeWidth && canResizeHeight) {
        if (cx !== 0) h = w / st.ratio;
        else if (cy !== 0) w = h * st.ratio;
      }

      // Snap to 4px grid first.
      w = snapToGrid(w);
      h = snapToGrid(h);

      // Snap the moving edge to sibling/parent edges -> snap the DIMENSION.
      const guides: Guide[] = [];
      const a = st.anchor;
      if (cx !== 0) {
        // moving edge x-position depends on which side grows.
        const movingEdge = cx > 0 ? a.left + w : a.right - w;
        const snap = computeSnap(
          "x",
          [movingEdge],
          st.targets,
          { min: a.top, max: a.bottom },
          6,
        );
        if (snap.delta !== 0) {
          w += snap.delta * cx;
          guides.push(...snap.guides);
        }
      }
      if (cy !== 0) {
        const movingEdge = cy > 0 ? a.top + h : a.bottom - h;
        const snap = computeSnap(
          "y",
          [movingEdge],
          st.targets,
          { min: a.left, max: a.right },
          6,
        );
        if (snap.delta !== 0) {
          h += snap.delta * cy;
          guides.push(...snap.guides);
        }
      }

      const wR = Math.round(w);
      const hR = Math.round(h);
      const edits: { section: "sizing"; key: "width" | "height"; value: number }[] = [];
      if (canResizeWidth && (cx !== 0 || (shift && canResizeHeight)))
        edits.push({ section: "sizing", key: "width", value: wR });
      if (canResizeHeight && (cy !== 0 || (shift && canResizeWidth)))
        edits.push({ section: "sizing", key: "height", value: hR });
      if (edits.length) writeStyles(actions, ctx.id!, breakpoint, edits);

      const movingRect: Rect = {
        left: cx < 0 ? a.right - w : a.left,
        top: cy < 0 ? a.bottom - h : a.top,
        right: cx > 0 ? a.left + w : a.right,
        bottom: cy > 0 ? a.top + h : a.bottom,
        width: w,
        height: h,
      };
      const badges = distanceBadges(movingRect, st.targets);
      drag.setFeedback({ guides, badges });
      setBadge({ w: wR, h: hR, x: a.left + wR + 8, y: a.top + hR + 8 });
    });
  };

  const endDrag = (e: React.PointerEvent): void => {
    if (!stateRef.current) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    stateRef.current = null;
    drag.setActive(false);
    drag.setFeedback({ guides: [], badges: [] });
    setBadge(null);
  };

  return (
    <>
      {/* Selection frame (the handles ride on its corners/edges). */}
      <div
        className="pointer-events-none fixed z-[60] border border-primary/60"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      />
      {visibleHandles.map((h) => (
        <div
          key={h.pos}
          role="slider"
          aria-label={`Resize ${h.pos}`}
          aria-valuenow={Math.round(h.cx ? rect.width : rect.height)}
          onPointerDown={beginDrag(h.pos)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="fixed z-[62] h-2.5 w-2.5 rounded-[2px] border border-primary bg-background shadow-sm"
          style={{
            left: rect.left + rect.width * h.cx,
            top: rect.top + rect.height * h.cy,
            transform: "translate(-50%, -50%)",
            cursor: h.cursor,
            touchAction: "none",
          }}
        />
      ))}
      {badge && (
        <ValueBadge left={badge.x} top={badge.y}>
          {badge.w} × {badge.h}
        </ValueBadge>
      )}
    </>
  );
};
