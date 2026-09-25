import * as React from "react";
import { useEditor } from "@craftjs/core";
import { useEditorUiStore } from "../store/editorUiStore";
import { readNum, writeStyles, type SpacingKey } from "./styleWrites";
import { rectOf, type Rect } from "./geometry";
import { useRafThrottle } from "./useOverlayMeasure";
import { useOverlayDrag } from "./dragContext";
import { ValueBadge } from "./GuideLayer";
import type { SelectionContext } from "./useSelectionContext";
import { useEnforcedGuardrails, isPropEditable } from "../guardrails/useGuardrails";

type Side = "Top" | "Right" | "Bottom" | "Left";
const SIDES: Side[] = ["Top", "Right", "Bottom", "Left"];

/** Max margin-band grab thickness — also used to inflate the hover zone. */
const HOVER_PAD = 40;

/** Opposite side, for Alt = symmetric editing. */
const OPPOSITE: Record<Side, Side> = { Top: "Bottom", Bottom: "Top", Left: "Right", Right: "Left" };

interface BandDrag {
  kind: "padding" | "margin";
  side: Side;
  startPos: number;
  startVal: number;
  oppStartVal: number;
  /** +1 if dragging inward grows the value along +client axis, else -1. */
  sign: number;
  vertical: boolean;
}

/**
 * Webflow-style spacing drag bands. On the selected node we draw an inner
 * PADDING band (inside the rect, per side) and an outer MARGIN band (outside the
 * rect, per side). Dragging a band edits the matching
 * `styles.spacing.{padding,margin}<Side>` at the active breakpoint with a live px
 * readout. Alt = symmetric (edits the opposite side too).
 *
 * The current px value is read from the StyleModel for the active breakpoint
 * (`readNum`), with the live computed padding from the DOM used only to size the
 * band visually when no explicit value is set. All writes go through Craft's
 * setProp into the same `spacing.*` paths StyleControls uses — no schema change.
 */
export const SpacingBands: React.FC<{ ctx: SelectionContext; measureTick: number }> = ({
  ctx,
  measureTick,
}) => {
  const { actions } = useEditor();
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const enforced = useEnforcedGuardrails(ctx.id);
  const { schedule } = useRafThrottle();
  const drag = useOverlayDrag();
  const dragRef = React.useRef<BandDrag | null>(null);
  const [badge, setBadge] = React.useState<{ x: number; y: number; text: string } | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const lastPointer = React.useRef({ x: 0, y: 0 });

  const dom = ctx.dom;
  const rect = React.useMemo<Rect | null>(
    () => (dom ? rectOf(dom) : null),
    [dom, measureTick],
  );
  // Computed padding (for visual band thickness when unset in the model).
  const computed = React.useMemo<CSSStyleDeclaration | null>(
    () => (dom ? getComputedStyle(dom) : null),
    [dom, measureTick],
  );

  const isInHoverZone = React.useCallback(
    (x: number, y: number, r: Rect): boolean =>
      x >= r.left - HOVER_PAD &&
      x <= r.right + HOVER_PAD &&
      y >= r.top - HOVER_PAD &&
      y <= r.bottom + HOVER_PAD,
    [],
  );

  const canEdit = React.useCallback(
    (kind: "padding" | "margin", side: Side): boolean =>
      isPropEditable(enforced, `styles.spacing.${kind}${side}`),
    [enforced],
  );

  // Track pointer hover over the selection + margin band zone.
  React.useEffect(() => {
    if (!rect || !dom) {
      setHovered(false);
      return;
    }
    const check = (x: number, y: number): void => {
      if (dragRef.current) {
        setHovered(true);
        return;
      }
      setHovered(isInHoverZone(x, y, rectOf(dom)));
    };
    const onMove = (e: PointerEvent): void => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
      check(e.clientX, e.clientY);
    };
    check(lastPointer.current.x, lastPointer.current.y);
    window.addEventListener("pointermove", onMove, true);
    return () => window.removeEventListener("pointermove", onMove, true);
  }, [dom, rect, ctx.id, isInHoverZone]);

  if (!dom || !rect || ctx.isRoot) return null;

  const hasEditableSpacing = (["padding", "margin"] as const).some((kind) =>
    SIDES.some((side) => canEdit(kind, side)),
  );
  if (!hasEditableSpacing) return null;

  const visible = hovered || isDragging || drag.active;

  const pad = (s: Side): number =>
    readNum(ctx.styles, breakpoint, "spacing", `padding${s}`) ??
    (computed ? parseFloat(computed[`padding${s}` as keyof CSSStyleDeclaration] as string) || 0 : 0);
  const mar = (s: Side): number =>
    readNum(ctx.styles, breakpoint, "spacing", `margin${s}`) ?? 0;

  const begin =
    (kind: "padding" | "margin", side: Side) =>
    (e: React.PointerEvent): void => {
      if (!canEdit(kind, side)) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const vertical = side === "Top" || side === "Bottom";
      const startVal = kind === "padding" ? pad(side) : mar(side);
      const oppStartVal = kind === "padding" ? pad(OPPOSITE[side]) : mar(OPPOSITE[side]);
      // Dragging a Top band downward (+y) increases top spacing; Bottom upward
      // (-y) increases bottom; Left rightward (+x) increases; Right leftward (-x).
      const sign = side === "Top" || side === "Left" ? 1 : -1;
      dragRef.current = {
        kind,
        side,
        startPos: vertical ? e.clientY : e.clientX,
        startVal,
        oppStartVal,
        sign,
        vertical,
      };
      setIsDragging(true);
      drag.setActive(true);
    };

  const onMove = (e: React.PointerEvent): void => {
    const st = dragRef.current;
    if (!st) return;
    const pos = st.vertical ? e.clientY : e.clientX;
    const alt = e.altKey;
    schedule(() => {
      const delta = (pos - st.startPos) * st.sign;
      const val = Math.max(0, Math.round(st.startVal + delta));
      const sect = "spacing";
      const key = `${st.kind}${st.side}` as SpacingKey;
      const edits: { section: string; key: string; value: number }[] = [
        { section: sect, key, value: val },
      ];
      if (alt && canEdit(st.kind, OPPOSITE[st.side])) {
        edits.push({ section: sect, key: `${st.kind}${OPPOSITE[st.side]}`, value: val });
      }
      writeStyles(actions, ctx.id!, breakpoint, edits);
      const r = rectOf(dom);
      const bx = st.vertical ? (r.left + r.right) / 2 : st.side === "Left" ? r.left : r.right;
      const by = st.vertical ? (st.side === "Top" ? r.top : r.bottom) : (r.top + r.bottom) / 2;
      setBadge({ x: bx + 8, y: by + 8, text: `${st.kind === "padding" ? "P" : "M"} ${val}px` });
    });
  };

  const end = (e: React.PointerEvent): void => {
    if (!dragRef.current) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setIsDragging(false);
    drag.setActive(false);
    setBadge(null);
  };

  // Band thickness clamps so it stays grabbable even at 0px spacing.
  const grab = (px: number): number => Math.max(6, Math.min(px, 40));

  const bandStyle = (
    kind: "padding" | "margin",
    side: Side,
  ): React.CSSProperties => {
    const size = kind === "padding" ? grab(pad(side)) : grab(mar(side));
    const vertical = side === "Top" || side === "Bottom";
    const color =
      kind === "padding" ? "rgba(16,185,129,0.18)" : "rgba(249,115,22,0.18)"; // green / orange
    const cursor = vertical ? "ns-resize" : "ew-resize";
    const base: React.CSSProperties = {
      position: "fixed",
      background: color,
      cursor,
      touchAction: "none",
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? "auto" : "none",
      transition: "opacity 120ms ease",
    };
    // Inner padding bands sit INSIDE the rect edge; margin bands OUTSIDE.
    if (kind === "padding") {
      if (vertical) {
        base.left = rect.left;
        base.width = rect.width;
        base.height = size;
        base.top = side === "Top" ? rect.top : rect.bottom - size;
      } else {
        base.top = rect.top;
        base.height = rect.height;
        base.width = size;
        base.left = side === "Left" ? rect.left : rect.right - size;
      }
    } else {
      if (vertical) {
        base.left = rect.left;
        base.width = rect.width;
        base.height = size;
        base.top = side === "Top" ? rect.top - size : rect.bottom;
      } else {
        base.top = rect.top;
        base.height = rect.height;
        base.width = size;
        base.left = side === "Left" ? rect.left - size : rect.right;
      }
    }
    return base;
  };

  return (
    <>
      {(["padding", "margin"] as const).map((kind) =>
        SIDES.map((side) => {
          if (!canEdit(kind, side)) return null;
          return (
          <div
            key={`${kind}-${side}`}
            role="slider"
            aria-label={`${kind} ${side.toLowerCase()}`}
            aria-valuenow={kind === "padding" ? pad(side) : mar(side)}
            className="z-[58]"
            style={bandStyle(kind, side)}
            onPointerDown={begin(kind, side)}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
          />
          );
        }),
      )}
      {badge && (
        <ValueBadge left={badge.x} top={badge.y}>
          {badge.text}
        </ValueBadge>
      )}
    </>
  );
};
