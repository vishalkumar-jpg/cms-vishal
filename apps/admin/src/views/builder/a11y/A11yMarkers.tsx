import * as React from "react";
import { useEditor } from "@craftjs/core";
import { useA11yIssues } from "./useA11yIssues";
import { useOverlayMeasure } from "../overlay/useOverlayMeasure";

/**
 * Lightweight on-canvas a11y markers. For each flagged node we render a small
 * fixed-position badge pinned to the node's real DOM rect (read from Craft's
 * `node.dom`, viewport coords — same approach as InlineBlockToolbar, but its own
 * layer so it never fights the canvas/overlay agent's files). Red = error,
 * amber = warning. Re-measures on scroll/resize/tree-change.
 */
export const A11yMarkers: React.FC = () => {
  const { flagged } = useA11yIssues();
  const { nodes } = useEditor((state) => ({ nodes: state.nodes }));

  const watched = React.useMemo(
    () => [...flagged.keys()].map((id) => nodes[id]?.dom ?? null),
    [flagged, nodes],
  );
  useOverlayMeasure(watched, [flagged]);

  if (flagged.size === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {[...flagged.entries()].map(([id, severity]) => {
        const dom = nodes[id]?.dom;
        if (!dom) return null;
        const rect = dom.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return null;
        const top = Math.max(rect.top + 2, 2);
        const left = Math.max(rect.left + 2, 2);
        const tone =
          severity === "error"
            ? "bg-red-500 text-white"
            : "bg-amber-400 text-amber-950";
        return (
          <div
            key={id}
            className={`absolute flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold shadow ${tone}`}
            style={{ top, left }}
            title={`Accessibility ${severity}`}
          >
            !
          </div>
        );
      })}
    </div>
  );
};
