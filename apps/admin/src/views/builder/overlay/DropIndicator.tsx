import * as React from "react";
import { useEditor } from "@craftjs/core";

/**
 * Live drop-indicator. Craft tracks the current drop placement on
 * `state.indicator` during BOTH a palette-item drag (new node) and an existing
 * block move — it carries the target parent node, the insertion index, and the
 * `where` ("before"/"after"). We turn that into a crisp insertion LINE between
 * the exact siblings plus a highlight on the target container, replacing Craft's
 * faint default bar with something unambiguous (Webflow/Framer feel).
 *
 * Read-only: we don't mutate anything — Craft still performs the actual move/drop
 * through its existing flow (so autosave + undo/redo are untouched). We only
 * render chrome from the placement it already computes.
 */
export const DropIndicator: React.FC = () => {
  // Subscribe to the indicator + a tick so we re-measure rects as it changes.
  const { placement, hasError } = useEditor((state) => {
    const ind = state.indicator;
    return {
      placement: ind?.placement ?? null,
      hasError: !!ind?.error,
    };
  });

  // Re-render on pointer move during a drag so the line follows live.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!placement) return;
    const onMove = (): void => force();
    window.addEventListener("dragover", onMove, true);
    window.addEventListener("pointermove", onMove, true);
    return () => {
      window.removeEventListener("dragover", onMove, true);
      window.removeEventListener("pointermove", onMove, true);
    };
  }, [placement]);

  if (!placement || !placement.parent?.dom) return null;

  const parentDom = placement.parent.dom;
  const parentRect = parentDom.getBoundingClientRect();
  const childIds: string[] = placement.parent.data.nodes ?? [];
  const where = placement.where; // "before" | "after"
  const refId = placement.currentNode?.id;
  const color = hasError ? "#ef4444" : "#6366f1"; // indigo for OK, red for invalid

  // Determine orientation from the parent's flex direction (column = horizontal line).
  const dir = getComputedStyle(parentDom).flexDirection;
  const horizontal = !dir.startsWith("row");

  // Anchor the line to the reference child's rect (the sibling we drop next to).
  const refIndex = refId ? childIds.indexOf(refId) : -1;
  const anchor: DOMRect | null = placement.currentNode?.dom
    ? placement.currentNode.dom.getBoundingClientRect()
    : null;

  let lineStyle: React.CSSProperties;
  if (anchor) {
    if (horizontal) {
      const y = where === "before" ? anchor.top : anchor.bottom;
      lineStyle = { left: anchor.left, top: y - 1.5, width: anchor.width, height: 3 };
    } else {
      const x = where === "before" ? anchor.left : anchor.right;
      lineStyle = { left: x - 1.5, top: anchor.top, width: 3, height: anchor.height };
    }
  } else {
    // Empty container — show a line near the top-inside.
    lineStyle = {
      left: parentRect.left + 8,
      top: parentRect.top + 8,
      width: parentRect.width - 16,
      height: 3,
    };
  }
  void refIndex;

  return (
    <>
      {/* Target container highlight. */}
      <div
        className="pointer-events-none fixed z-[66] rounded-sm"
        style={{
          left: parentRect.left,
          top: parentRect.top,
          width: parentRect.width,
          height: parentRect.height,
          boxShadow: `inset 0 0 0 2px ${color}`,
          background: `${color}0d`,
        }}
      />
      {/* Insertion line. */}
      <div
        className="pointer-events-none fixed z-[67] rounded-full"
        style={{ ...lineStyle, background: color, boxShadow: `0 0 0 1px ${color}55` }}
      />
    </>
  );
};
