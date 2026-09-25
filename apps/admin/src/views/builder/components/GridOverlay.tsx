import * as React from "react";
import { useEditorUiStore } from "../store/editorUiStore";
import { useCanvasViewportStore } from "../store/canvasViewportStore";

/** Visual grid overlay scoped to the canvas frame (editor-only). */
export const GridOverlay: React.FC = React.memo(() => {
  const show = useEditorUiStore((s) => s.showGridOverlay);
  const zoom = useEditorUiStore((s) => s.canvasZoom);
  const frameRect = useCanvasViewportStore((s) => s.frameRect);

  if (!show || !frameRect) return null;

  const size = 24 * zoom;

  return (
    <div
      className="pointer-events-none fixed z-[12] rounded-sm"
      aria-hidden
      style={{
        left: frameRect.left,
        top: frameRect.top,
        width: frameRect.width,
        height: frameRect.height,
        backgroundImage: `
          linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
});
GridOverlay.displayName = "GridOverlay";
