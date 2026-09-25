import * as React from "react";
import { useEditor } from "@craftjs/core";
import { ChevronRight } from "lucide-react";
import { resolveLayerName } from "../craft/layerMeta";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Clickable ancestor chain above the property panel — jump to any parent block.
 */
export const SelectionBreadcrumb: React.FC<{ selectedId: string }> = ({ selectedId }) => {
  const { actions, query } = useEditor();
  const subPart = useEditorUiStore((s) => s.subPart);
  const clearSubPart = useEditorUiStore((s) => s.clearSubPart);

  const crumbs = React.useMemo(() => {
    const out: { id: string; label: string }[] = [];
    try {
      let cur: string | null = selectedId;
      while (cur && cur !== "ROOT") {
        const node = query.node(cur).get();
        out.unshift({
          id: cur,
          label: resolveLayerName(node),
        });
        cur = node.data.parent ?? null;
      }
    } catch {
      /* node gone */
    }
    return out;
  }, [selectedId, query]);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Block hierarchy"
      className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-2 text-[11px]"
    >
      <button
        type="button"
        onClick={() => {
          clearSubPart();
          actions.selectNode("ROOT");
        }}
        className="rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Page
      </button>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.id}>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />
          <button
            type="button"
            onClick={() => {
              if (subPart?.nodeId !== c.id) clearSubPart();
              actions.selectNode(c.id);
            }}
            className={`max-w-[8rem] truncate rounded px-1 py-0.5 transition-colors hover:bg-accent ${
              i === crumbs.length - 1 && !subPart
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={c.label}
          >
            {c.label}
          </button>
        </React.Fragment>
      ))}
      {subPart && subPart.nodeId === selectedId ? (
        <>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />
          <span className="max-w-[8rem] truncate font-semibold text-foreground" title={subPart.label}>
            {subPart.label}
          </span>
        </>
      ) : null}
    </nav>
  );
};
