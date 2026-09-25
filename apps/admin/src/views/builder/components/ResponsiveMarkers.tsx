import * as React from "react";
import { useEditor } from "@craftjs/core";
import { useEditorUiStore } from "../store/editorUiStore";
import { useResponsiveAudit } from "../responsive/useResponsiveAudit";

/** On-canvas badges for blocks with responsive overrides or issues. */
export const ResponsiveMarkers: React.FC = () => {
  const show = useEditorUiStore((s) => s.showResponsiveMarkers);
  const { query } = useEditor();
  const audit = useResponsiveAudit();

  const markers = React.useMemo(() => {
    if (!show) return [];
    const issueIds = new Set(audit.issues.map((i) => i.nodeId));
    const out: Array<{ id: string; x: number; y: number; kind: "override" | "issue" }> = [];
    for (const id of Object.keys(query.getNodes())) {
      if (id === "ROOT") continue;
      try {
        const node = query.node(id).get();
        const dom = node.dom as HTMLElement | null;
        if (!dom) continue;
        const rect = dom.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const styles = (node.data.props as { styles?: Record<string, unknown> })?.styles ?? {};
        const responsive = styles.responsive as Record<string, unknown> | undefined;
        const hasOverride = responsive && Object.keys(responsive).length > 0;
        if (issueIds.has(id)) {
          out.push({ id, x: rect.right - 8, y: rect.top + 4, kind: "issue" });
        } else if (hasOverride) {
          out.push({ id, x: rect.right - 8, y: rect.top + 4, kind: "override" });
        }
      } catch {
        /* skip */
      }
    }
    return out;
  }, [show, query, audit.issues]);

  if (!show || markers.length === 0) return null;

  return (
    <>
      {markers.map((m) => (
        <span
          key={m.id}
          className={`pointer-events-none fixed z-[55] h-2.5 w-2.5 rounded-full ${
            m.kind === "issue" ? "bg-amber-500" : "bg-sky-500"
          }`}
          style={{ left: m.x, top: m.y }}
          title={m.kind === "issue" ? "Responsive issue" : "Has tablet/mobile overrides"}
          aria-hidden
        />
      ))}
    </>
  );
};
