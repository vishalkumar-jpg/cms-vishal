import * as React from "react";
import { useEditorUiStore } from "../store/editorUiStore";
import { useCanvasViewportStore } from "../store/canvasViewportStore";

const RULER_SIZE = 20;
const MAJOR = 100;
const MINOR = 10;

/** Figma-style horizontal + vertical pixel rulers synced to canvas scroll. */
export const RulersOverlay: React.FC = React.memo(() => {
  const show = useEditorUiStore((s) => s.showRulers);
  const zoom = useEditorUiStore((s) => s.canvasZoom);
  const frameRect = useCanvasViewportStore((s) => s.frameRect);
  const scrollLeft = useCanvasViewportStore((s) => s.scrollLeft);
  const scrollTop = useCanvasViewportStore((s) => s.scrollTop);
  const cursor = useCanvasViewportStore((s) => s.cursor);

  const ticks = React.useMemo(() => {
    if (!frameRect) return { h: [] as number[], v: [] as number[] };
    const span = Math.max(frameRect.width, frameRect.height, 800) + 400;
    const h: number[] = [];
    const v: number[] = [];
    for (let i = 0; i <= span; i += MINOR) {
      if (i % MAJOR === 0) {
        h.push(i);
        v.push(i);
      }
    }
    return { h, v };
  }, [frameRect]);

  if (!show || !frameRect) return null;

  return (
    <>
      {/* Corner */}
      <div
        className="pointer-events-none fixed z-[13] border-r border-b border-border bg-muted/90"
        style={{ left: 0, top: 0, width: RULER_SIZE, height: RULER_SIZE }}
        aria-hidden
      />
      {/* Horizontal ruler */}
      <div
        className="pointer-events-none fixed z-[13] overflow-hidden border-b border-border bg-muted/90"
        style={{ left: RULER_SIZE, top: 0, right: 0, height: RULER_SIZE }}
        aria-hidden
      >
        <svg width="100%" height={RULER_SIZE} className="text-[9px] text-muted-foreground">
          {ticks.h.map((px) => {
            const screenX = frameRect.left - scrollLeft + px * zoom;
            if (screenX < RULER_SIZE || screenX > window.innerWidth) return null;
            const major = px % MAJOR === 0;
            return (
              <g key={`h-${px}`}>
                <line x1={screenX} y1={RULER_SIZE - (major ? 10 : 5)} x2={screenX} y2={RULER_SIZE} stroke="currentColor" strokeWidth={1} />
                {major ? (
                  <text x={screenX + 2} y={10} fill="currentColor">
                    {px}
                  </text>
                ) : null}
              </g>
            );
          })}
          {cursor ? (
            <line
              x1={cursor.x}
              y1={0}
              x2={cursor.x}
              y2={RULER_SIZE}
              stroke="hsl(var(--primary))"
              strokeWidth={1}
            />
          ) : null}
        </svg>
      </div>
      {/* Vertical ruler */}
      <div
        className="pointer-events-none fixed z-[13] overflow-hidden border-r border-border bg-muted/90"
        style={{ left: 0, top: RULER_SIZE, bottom: 0, width: RULER_SIZE }}
        aria-hidden
      >
        <svg width={RULER_SIZE} height="100%" className="text-[9px] text-muted-foreground">
          {ticks.v.map((px) => {
            const screenY = frameRect.top - scrollTop + px * zoom;
            if (screenY < RULER_SIZE || screenY > window.innerHeight) return null;
            const major = px % MAJOR === 0;
            return (
              <g key={`v-${px}`}>
                <line x1={RULER_SIZE - (major ? 10 : 5)} y1={screenY} x2={RULER_SIZE} y2={screenY} stroke="currentColor" strokeWidth={1} />
                {major ? (
                  <text x={2} y={screenY + 10} fill="currentColor" transform={`rotate(-90 2 ${screenY + 10})`}>
                    {px}
                  </text>
                ) : null}
              </g>
            );
          })}
          {cursor ? (
            <line
              x1={0}
              y1={cursor.y}
              x2={RULER_SIZE}
              y2={cursor.y}
              stroke="hsl(var(--primary))"
              strokeWidth={1}
            />
          ) : null}
        </svg>
      </div>
    </>
  );
});
RulersOverlay.displayName = "RulersOverlay";
