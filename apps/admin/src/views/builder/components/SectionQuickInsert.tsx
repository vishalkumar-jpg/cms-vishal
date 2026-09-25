import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Plus } from "lucide-react";
import { QuickBlockPicker } from "./QuickBlockPicker";
import { useEditorUiStore } from "../store/editorUiStore";

interface GapSlot {
  index: number;
  top: number;
  left: number;
  width: number;
}

/**
 * Shows "+" affordances between top-level sections. Click opens quick block picker.
 */
export const SectionQuickInsert: React.FC = () => {
  const { query } = useEditor();
  const editMode = useEditorUiStore((s) => s.editMode);
  const modalOpen = useEditorUiStore((s) => s.modalDialogOpen);
  const [gaps, setGaps] = React.useState<GapSlot[]>([]);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const popRef = React.useRef<HTMLDivElement>(null);

  const measure = React.useCallback(() => {
    if (editMode !== "structure") {
      setGaps([]);
      return;
    }
    try {
      const root = query.node("ROOT").get();
      const childIds = root.data.nodes ?? [];
      const next: GapSlot[] = [];
      for (let i = 0; i <= childIds.length; i++) {
        let top = 0;
        let left = 0;
        let width = 400;
        if (i === 0 && childIds.length > 0) {
          const dom = query.node(childIds[0]).get().dom;
          if (!dom) continue;
          const r = dom.getBoundingClientRect();
          top = r.top - 12;
          left = r.left + r.width / 2;
          width = Math.min(r.width, 480);
        } else if (i > 0 && i < childIds.length) {
          const prev = query.node(childIds[i - 1]).get().dom;
          const nextEl = query.node(childIds[i]).get().dom;
          if (!prev || !nextEl) continue;
          const pr = prev.getBoundingClientRect();
          const nr = nextEl.getBoundingClientRect();
          top = (pr.bottom + nr.top) / 2;
          left = (pr.left + pr.width / 2 + nr.left + nr.width / 2) / 2;
          width = Math.min(Math.max(pr.width, nr.width), 480);
        } else if (i === childIds.length && childIds.length > 0) {
          const dom = query.node(childIds[childIds.length - 1]).get().dom;
          if (!dom) continue;
          const r = dom.getBoundingClientRect();
          top = r.bottom + 12;
          left = r.left + r.width / 2;
          width = Math.min(r.width, 480);
        } else {
          continue;
        }
        next.push({ index: i, top, left, width });
      }
      setGaps(next);
    } catch {
      setGaps([]);
    }
  }, [query, editMode]);

  React.useEffect(() => {
    measure();
    const id = window.setInterval(measure, 400);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  React.useEffect(() => {
    if (openIndex == null) return;
    const close = (e: MouseEvent): void => {
      if (popRef.current?.contains(e.target as Node)) return;
      setOpenIndex(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [openIndex]);

  if (editMode !== "structure" || modalOpen || gaps.length === 0) return null;

  return (
    <>
      {gaps.map((g) => (
        <button
          key={g.index}
          type="button"
          aria-label="Insert block here"
          title="Insert block here"
          onClick={(e) => {
            e.stopPropagation();
            setOpenIndex(openIndex === g.index ? null : g.index);
          }}
          className="fixed z-[55] flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground shadow-md transition hover:scale-110"
          style={{ top: g.top, left: g.left }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      ))}
      {openIndex != null && gaps.find((g) => g.index === openIndex) ? (
        <div
          ref={popRef}
          className="fixed z-[56] max-h-[24rem] w-72 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xl"
          style={{
            top: gaps.find((g) => g.index === openIndex)!.top + 16,
            left: Math.min(
              window.innerWidth - 300,
              gaps.find((g) => g.index === openIndex)!.left - 144,
            ),
          }}
        >
          <p className="mb-2 text-xs font-semibold text-foreground">Insert block</p>
          <QuickBlockPicker
            compact
            insertIndex={openIndex}
            onInserted={() => setOpenIndex(null)}
          />
        </div>
      ) : null}
    </>
  );
};
