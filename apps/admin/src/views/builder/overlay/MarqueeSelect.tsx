import * as React from "react";
import { useEditor } from "@craftjs/core";
import { cn } from "@/lib/cn";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Drag a rectangle on empty canvas space to multi-select blocks.
 */
export const MarqueeSelect: React.FC = () => {
  const { query, actions } = useEditor();
  const editMode = useEditorUiStore((s) => s.editMode);
  const setExtraSelected = useEditorUiStore((s) => s.setExtraSelected);
  const [rect, setRect] = React.useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const rectRef = React.useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  React.useEffect(() => {
    if (editMode !== "structure") return;

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (!t.closest(".ob-site")) return;
      if (t.closest("[contenteditable='true']")) return;
      for (const id of Object.keys(query.getNodes())) {
        if (id === "ROOT") continue;
        try {
          const dom = query.node(id).get().dom;
          if (dom && (dom === t || dom.contains(t))) return;
        } catch {
          /* skip */
        }
      }
      startRef.current = { x: e.clientX, y: e.clientY };
      const box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
      rectRef.current = box;
      setRect(box);
    };

    const onMouseMove = (e: MouseEvent): void => {
      const start = startRef.current;
      if (!start) return;
      const box = { x0: start.x, y0: start.y, x1: e.clientX, y1: e.clientY };
      rectRef.current = box;
      setRect(box);
    };

    const onMouseUp = (): void => {
      const box = rectRef.current;
      startRef.current = null;
      rectRef.current = null;
      if (box) {
        const left = Math.min(box.x0, box.x1);
        const right = Math.max(box.x0, box.x1);
        const top = Math.min(box.y0, box.y1);
        const bottom = Math.max(box.y0, box.y1);
        if (right - left > 8 && bottom - top > 8) {
          const hits: string[] = [];
          for (const id of Object.keys(query.getNodes())) {
            if (id === "ROOT") continue;
            try {
              const dom = query.node(id).get().dom;
              if (!dom) continue;
              const r = dom.getBoundingClientRect();
              const intersects = !(r.right < left || r.left > right || r.bottom < top || r.top > bottom);
              if (intersects) hits.push(id);
            } catch {
              /* skip */
            }
          }
          if (hits.length > 0) {
            actions.selectNode(hits[0]);
            setExtraSelected(hits.slice(1));
          }
        }
      }
      setRect(null);
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [editMode, query, actions, setExtraSelected]);

  if (!rect) return null;

  return (
    <div
      className={cn("pointer-events-none fixed z-[54] border-2 border-primary bg-primary/10")}
      style={{
        left: Math.min(rect.x0, rect.x1),
        top: Math.min(rect.y0, rect.y1),
        width: Math.abs(rect.x1 - rect.x0),
        height: Math.abs(rect.y1 - rect.y0),
      }}
    />
  );
};
