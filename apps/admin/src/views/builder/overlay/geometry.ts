/**
 * Pure geometry + snapping helpers for the direct-manipulation overlay.
 *
 * All rects here are in VIEWPORT coordinates (the value returned by
 * `getBoundingClientRect`), because the overlay is a fixed-position layer — the
 * same coordinate space the existing InlineBlockToolbar pins to. Keeping it pure
 * (no DOM, no React) makes the snap math testable and cheap to run in a rAF loop.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export const GRID = 4;
export const SNAP_THRESHOLD = 6;

export const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  };
};

/** Snap a value to the nearest multiple of `grid`. */
export const snapToGrid = (v: number, grid = GRID): number => Math.round(v / grid) * grid;

export type GuideAxis = "x" | "y";

/** A rendered alignment guide line (viewport coords). */
export interface Guide {
  axis: GuideAxis;
  /** position along the perpendicular axis (x for vertical line, y for horizontal). */
  pos: number;
  /** extent along the line so we can draw it tight around the involved rects. */
  start: number;
  end: number;
}

/** A live distance badge between the dragged rect and a neighbor. */
export interface DistanceBadge {
  x: number;
  y: number;
  px: number;
  axis: GuideAxis;
}

/** Candidate snap positions on one axis, with the guide they'd render. */
interface SnapCandidate {
  value: number;
  guide: Guide;
}

/**
 * Given the moving rect's candidate edge/center positions on an axis and a set of
 * target rects, return the best snap (within threshold) plus the guide line.
 *
 * `movingLines` are the absolute positions of the moving rect's left/center/right
 * (or top/middle/bottom) that we want to align; `delta` returned is how far to
 * shift the moving rect so its nearest line lands on a target line.
 */
export const computeSnap = (
  axis: GuideAxis,
  movingLines: number[],
  targets: Rect[],
  perpRange: { min: number; max: number },
  threshold = SNAP_THRESHOLD,
): { delta: number; guides: Guide[] } => {
  const targetLines: number[] = [];
  for (const t of targets) {
    if (axis === "x") targetLines.push(t.left, (t.left + t.right) / 2, t.right);
    else targetLines.push(t.top, (t.top + t.bottom) / 2, t.bottom);
  }

  let best: SnapCandidate | null = null;
  let bestDist = threshold + 1;
  for (const ml of movingLines) {
    for (const tl of targetLines) {
      const d = Math.abs(ml - tl);
      if (d <= threshold && d < bestDist) {
        bestDist = d;
        best = {
          value: tl - ml, // delta to apply
          guide: { axis, pos: tl, start: perpRange.min, end: perpRange.max },
        };
      }
    }
  }
  if (!best) return { delta: 0, guides: [] };
  return { delta: best.value, guides: [best.guide] };
};

/**
 * Detect edge/center alignment between a moving rect and snap targets on both
 * axes. Returns the shift deltas (for move) and the guide lines to render.
 */
export const computeRectSnap = (
  moving: Rect,
  targets: Rect[],
  threshold = SNAP_THRESHOLD,
): { dx: number; dy: number; guides: Guide[] } => {
  const xSnap = computeSnap(
    "x",
    [moving.left, (moving.left + moving.right) / 2, moving.right],
    targets,
    { min: moving.top, max: moving.bottom },
    threshold,
  );
  const ySnap = computeSnap(
    "y",
    [moving.top, (moving.top + moving.bottom) / 2, moving.bottom],
    targets,
    { min: moving.left, max: moving.right },
    threshold,
  );
  return { dx: xSnap.delta, dy: ySnap.delta, guides: [...xSnap.guides, ...ySnap.guides] };
};

/** Build the perpendicular extent for a guide so it hugs both rects. */
export const perpRangeFor = (axis: GuideAxis, a: Rect, b: Rect): { min: number; max: number } => {
  if (axis === "x") {
    return { min: Math.min(a.top, b.top), max: Math.max(a.bottom, b.bottom) };
  }
  return { min: Math.min(a.left, b.left), max: Math.max(a.right, b.right) };
};

/**
 * Compute the gap-distance badges between a rect and its siblings on both axes
 * (nearest neighbor each side). Used to show "12px" style spacing readouts while
 * dragging, like Figma/Framer.
 */
export const distanceBadges = (moving: Rect, siblings: Rect[]): DistanceBadge[] => {
  const badges: DistanceBadge[] = [];
  // Horizontal gaps to siblings that vertically overlap.
  const vOverlap = siblings.filter((s) => s.bottom > moving.top && s.top < moving.bottom);
  let leftGap: { px: number; at: number } | null = null;
  let rightGap: { px: number; at: number } | null = null;
  for (const s of vOverlap) {
    if (s.right <= moving.left) {
      const px = moving.left - s.right;
      if (!leftGap || px < leftGap.px) leftGap = { px, at: s.right };
    } else if (s.left >= moving.right) {
      const px = s.left - moving.right;
      if (!rightGap || px < rightGap.px) rightGap = { px, at: moving.right };
    }
  }
  const midY = (moving.top + moving.bottom) / 2;
  if (leftGap) badges.push({ axis: "x", px: Math.round(leftGap.px), x: leftGap.at + leftGap.px / 2, y: midY });
  if (rightGap) badges.push({ axis: "x", px: Math.round(rightGap.px), x: rightGap.at + rightGap.px / 2, y: midY });

  const hOverlap = siblings.filter((s) => s.right > moving.left && s.left < moving.right);
  let topGap: { px: number; at: number } | null = null;
  let botGap: { px: number; at: number } | null = null;
  for (const s of hOverlap) {
    if (s.bottom <= moving.top) {
      const px = moving.top - s.bottom;
      if (!topGap || px < topGap.px) topGap = { px, at: s.bottom };
    } else if (s.top >= moving.bottom) {
      const px = s.top - moving.bottom;
      if (!botGap || px < botGap.px) botGap = { px, at: moving.bottom };
    }
  }
  const midX = (moving.left + moving.right) / 2;
  if (topGap) badges.push({ axis: "y", px: Math.round(topGap.px), x: midX, y: topGap.at + topGap.px / 2 });
  if (botGap) badges.push({ axis: "y", px: Math.round(botGap.px), x: midX, y: botGap.at + botGap.px / 2 });

  return badges;
};
