import type { useEditor } from "@craftjs/core";
import type { Breakpoint } from "../property/styleTokens";
import { writeStyles, readNum } from "./styleWrites";

type EditorQuery = ReturnType<typeof useEditor>["query"];
type EditorActions = ReturnType<typeof useEditor>["actions"];

export type AlignKind = "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom";
export type DistributeKind = "horizontal" | "vertical";

interface Measured {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  marginLeft: number;
  marginTop: number;
}

const measure = (
  query: EditorQuery,
  ids: string[],
  styles: (id: string) => Record<string, unknown>,
  breakpoint: Breakpoint,
): Measured[] => {
  const out: Measured[] = [];
  for (const id of ids) {
    let dom: HTMLElement | null = null;
    try {
      dom = query.node(id).get().dom ?? null;
    } catch {
      dom = null;
    }
    if (!dom) continue;
    const r = dom.getBoundingClientRect();
    out.push({
      id,
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      marginLeft: readNum(styles(id), breakpoint, "spacing", "marginLeft") ?? 0,
      marginTop: readNum(styles(id), breakpoint, "spacing", "marginTop") ?? 0,
    });
  }
  return out;
};

/**
 * Align / distribute a multi-selection. Because blocks are flow-positioned, we
 * align by adjusting each element's `marginLeft` / `marginTop` (the same
 * `styles.spacing.*` paths the panel uses) so the visual edges/centers line up
 * with the group's bounding box — and it all flows through Craft's setProp =>
 * autosave + undo/redo, respecting the active breakpoint. This is a pragmatic
 * direct-manipulation align that never alters the StyleModel shape.
 */
export const alignNodes = (
  query: EditorQuery,
  actions: EditorActions,
  ids: string[],
  kind: AlignKind,
  breakpoint: Breakpoint,
): void => {
  const stylesOf = (id: string): Record<string, unknown> =>
    (query.node(id).get().data.props["styles"] ?? {}) as Record<string, unknown>;
  const items = measure(query, ids, stylesOf, breakpoint);
  if (items.length < 2) return;

  const minL = Math.min(...items.map((i) => i.left));
  const maxR = Math.max(...items.map((i) => i.right));
  const minT = Math.min(...items.map((i) => i.top));
  const maxB = Math.max(...items.map((i) => i.bottom));
  const cx = (minL + maxR) / 2;
  const cy = (minT + maxB) / 2;

  for (const it of items) {
    let dLeft = 0;
    let dTop = 0;
    switch (kind) {
      case "left":
        dLeft = minL - it.left;
        break;
      case "right":
        dLeft = maxR - it.right;
        break;
      case "hcenter":
        dLeft = cx - (it.left + it.width / 2);
        break;
      case "top":
        dTop = minT - it.top;
        break;
      case "bottom":
        dTop = maxB - it.bottom;
        break;
      case "vmiddle":
        dTop = cy - (it.top + it.height / 2);
        break;
    }
    const edits: { section: string; key: string; value: number }[] = [];
    if (dLeft !== 0)
      edits.push({ section: "spacing", key: "marginLeft", value: Math.round(it.marginLeft + dLeft) });
    if (dTop !== 0)
      edits.push({ section: "spacing", key: "marginTop", value: Math.round(it.marginTop + dTop) });
    if (edits.length) writeStyles(actions, it.id, breakpoint, edits);
  }
};

/**
 * Distribute: equalize the gaps between elements along an axis by nudging their
 * leading margin. Sorts by current position, keeps the two extremes fixed, and
 * spaces the middle ones evenly.
 */
export const distributeNodes = (
  query: EditorQuery,
  actions: EditorActions,
  ids: string[],
  kind: DistributeKind,
  breakpoint: Breakpoint,
): void => {
  const stylesOf = (id: string): Record<string, unknown> =>
    (query.node(id).get().data.props["styles"] ?? {}) as Record<string, unknown>;
  const items = measure(query, ids, stylesOf, breakpoint);
  if (items.length < 3) return;

  const horizontal = kind === "horizontal";
  const sorted = [...items].sort((a, b) => (horizontal ? a.left - b.left : a.top - b.top));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSize = sorted.reduce((s, i) => s + (horizontal ? i.width : i.height), 0);
  const span = horizontal ? last.right - first.left : last.bottom - first.top;
  const gap = (span - totalSize) / (sorted.length - 1);

  let cursor = horizontal ? first.left : first.top;
  for (const it of sorted) {
    const target = cursor;
    const current = horizontal ? it.left : it.top;
    const d = target - current;
    if (d !== 0) {
      const key = horizontal ? "marginLeft" : "marginTop";
      const startVal = horizontal ? it.marginLeft : it.marginTop;
      writeStyles(actions, it.id, breakpoint, [
        { section: "spacing", key, value: Math.round(startVal + d) },
      ]);
    }
    cursor += (horizontal ? it.width : it.height) + gap;
  }
};
