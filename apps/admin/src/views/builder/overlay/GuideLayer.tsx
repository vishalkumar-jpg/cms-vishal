import * as React from "react";
import type { DistanceBadge, Guide } from "./geometry";

const MAGENTA = "#e6007a";

/**
 * Renders the smart-alignment chrome shared by all drag interactions: crisp
 * magenta snap lines and px distance badges. Pure presentational — the active
 * drag (resize / move) feeds it `guides` + `badges` in viewport coords. Sits at
 * the top of the overlay stack with `pointer-events: none` so it never eats input.
 */
export const GuideLayer: React.FC<{ guides: Guide[]; badges: DistanceBadge[] }> = ({
  guides,
  badges,
}) => {
  if (guides.length === 0 && badges.length === 0) return null;
  return (
  <>
    {guides.map((g, i) => (
      <div
        key={`g${i}`}
        className="pointer-events-none fixed z-[70]"
        style={
          g.axis === "x"
            ? {
                left: g.pos,
                top: g.start,
                height: Math.max(1, g.end - g.start),
                width: 1,
                background: MAGENTA,
                transform: "translateX(-0.5px)",
              }
            : {
                top: g.pos,
                left: g.start,
                width: Math.max(1, g.end - g.start),
                height: 1,
                background: MAGENTA,
                transform: "translateY(-0.5px)",
              }
        }
      />
    ))}
    {badges.map((b, i) => (
      <div
        key={`b${i}`}
        className="pointer-events-none fixed z-[71] rounded-sm px-1 text-[10px] font-semibold leading-tight text-white"
        style={{
          left: b.x,
          top: b.y,
          transform: "translate(-50%, -50%)",
          background: MAGENTA,
          whiteSpace: "nowrap",
        }}
      >
        {b.px}
      </div>
    ))}
  </>
  );
};

/** Small floating readout (size / spacing px) pinned near the cursor or edge. */
export const ValueBadge: React.FC<{
  left: number;
  top: number;
  children: React.ReactNode;
}> = ({ left, top, children }) => (
  <div
    className="pointer-events-none fixed z-[72] rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-primary-foreground shadow"
    style={{ left, top, whiteSpace: "nowrap" }}
  >
    {children}
  </div>
);
