import * as React from "react";
import { useEditorUiStore } from "../store/editorUiStore";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    label: el.getAttribute("data-subpart-label") ?? "Part",
  };
};

/**
 * Hover + selection highlight for block sub-parts. Fixed-position overlay (like
 * the resize/spacing chrome) that:
 *  - outlines the `data-subpart` element under the cursor (dashed, with a label
 *    chip) so authors can see what they'll select, and
 *  - outlines the currently SELECTED sub-part (solid) read from the editor store.
 *
 * Pure chrome — `pointer-events: none`, never mutates anything.
 */
export const SubPartOverlay: React.FC = () => {
  const subPart = useEditorUiStore((s) => s.subPart);
  const [hover, setHover] = React.useState<Box | null>(null);
  const [, force] = React.useReducer((n: number) => (n + 1) % 1_000_000, 0);

  // Track the sub-part under the pointer.
  React.useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const target = e.target as Element | null;
      const partEl = target?.closest("[data-subpart]") ?? null;
      setHover(partEl ? boxOf(partEl) : null);
    };
    const onLeaveOrScroll = (): void => force();
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("scroll", onLeaveOrScroll, true);
    window.addEventListener("resize", onLeaveOrScroll);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("scroll", onLeaveOrScroll, true);
      window.removeEventListener("resize", onLeaveOrScroll);
    };
  }, []);

  // Resolve the selected sub-part's live DOM rect each render.
  const selected = React.useMemo<Box | null>(() => {
    if (!subPart) return null;
    const el = document.querySelector(
      `[data-craft-node-id="${CSS.escape(subPart.nodeId)}"] [data-subpart="${CSS.escape(subPart.key)}"]`,
    );
    return el ? boxOf(el) : null;
  }, [subPart, hover]);

  const showHover = hover && (!selected || hover.label !== selected.label);

  return (
    <>
      {selected && (
        <div
          className="pointer-events-none fixed z-[63] rounded-sm"
          style={{
            left: selected.left,
            top: selected.top,
            width: selected.width,
            height: selected.height,
            boxShadow: "0 0 0 2px hsl(var(--primary))",
          }}
        >
          <span
            className="absolute -top-5 left-0 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
            style={{ whiteSpace: "nowrap" }}
          >
            {selected.label}
          </span>
        </div>
      )}
      {showHover && (
        <div
          className="pointer-events-none fixed z-[62] rounded-sm"
          style={{
            left: hover.left,
            top: hover.top,
            width: hover.width,
            height: hover.height,
            boxShadow: "0 0 0 1.5px hsl(var(--ring))",
            background: "hsl(var(--ring) / 0.06)",
          }}
        >
          <span
            className="absolute -top-5 left-0 rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] font-medium leading-none text-background"
            style={{ whiteSpace: "nowrap" }}
          >
            {hover.label}
          </span>
        </div>
      )}
    </>
  );
};
