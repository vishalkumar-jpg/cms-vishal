import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  auditResponsiveStyles,
  RESP_MOBILE_W,
  type ResponsiveFinding,
  type ResponsiveFix,
} from "@ob-cms/block-schema";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Live responsive audit for the current page. Walks the Craft tree, runs the
 * pure StyleModel checks (fixed width, mobile overflow, unreadable font) on each
 * node, and adds a DOM-measured horizontal-overflow check against the canvas
 * container at the CURRENT breakpoint (switch the toolbar to Mobile for the most
 * accurate overflow detection). Recomputed, debounced, as the layout or
 * breakpoint changes — mirrors `useA11yIssues`.
 */
export interface ResponsiveIssue extends ResponsiveFinding {
  nodeId: string;
  blockName: string;
}

export interface ResponsiveAuditResult {
  issues: ResponsiveIssue[];
  /** Count by severity for the summary badge. */
  errors: number;
  warnings: number;
  /** Highest-severity flag per node (for canvas markers, if wired later). */
  flagged: Map<string, "error" | "warn">;
}

const EMPTY: ResponsiveAuditResult = {
  issues: [],
  errors: 0,
  warnings: 0,
  flagged: new Map(),
};

/** Nearest `.ob-site` container rect (the width-constrained canvas root). */
const siteRect = (el: HTMLElement): DOMRect | null => {
  const site = el.closest(".ob-site") as HTMLElement | null;
  return site ? site.getBoundingClientRect() : null;
};

export const useResponsiveAudit = (): ResponsiveAuditResult => {
  const { serialized } = useEditor((_, q) => ({ serialized: q.serialize() }));
  const { query } = useEditor();
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const [result, setResult] = React.useState<ResponsiveAuditResult>(EMPTY);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      let nodeMap: Record<string, unknown> = {};
      try {
        nodeMap = JSON.parse(serialized) as Record<string, unknown>;
      } catch {
        return;
      }

      const order: string[] = [];
      const visit = (id: string): void => {
        if (order.includes(id)) return;
        order.push(id);
        const n = nodeMap[id] as { nodes?: string[] } | undefined;
        for (const child of n?.nodes ?? []) visit(child);
      };
      visit("ROOT");

      const issues: ResponsiveIssue[] = [];

      for (const id of order) {
        if (id === "ROOT") continue;
        let blockName = "";
        let props: Record<string, unknown> = {};
        let dom: HTMLElement | null = null;
        try {
          const node = query.node(id).get();
          blockName = node.data.displayName || node.data.name || "";
          props = node.data.props as Record<string, unknown>;
          dom = (node.dom as HTMLElement | null) ?? null;
        } catch {
          continue;
        }

        const styles = props["styles"];
        const findings = auditResponsiveStyles(styles);

        // DOM-measured horizontal overflow at the current breakpoint. Only add
        // it when the static checks didn't already flag this node's width, to
        // avoid duplicate "make full width" rows.
        const alreadyWidthFlagged = findings.some(
          (f) => f.rule === "mobile-overflow" || f.rule === "fixed-width",
        );
        if (dom && !alreadyWidthFlagged) {
          const rect = dom.getBoundingClientRect();
          const site = siteRect(dom);
          const overflowsSite = site ? rect.right > site.right + 1 || rect.width > site.width + 1 : false;
          const selfOverflow = dom.scrollWidth > dom.clientWidth + 1;
          if (overflowsSite || selfOverflow) {
            const fix: ResponsiveFix = {
              path: "styles.responsive.mobile.sizing.width",
              value: "100%",
              label: "Make full-width on mobile",
            };
            issues.push({
              nodeId: id,
              blockName,
              rule: "mobile-overflow",
              severity: "error",
              message:
                breakpoint === "mobile"
                  ? "This block spills past the phone screen edge."
                  : `This block is wider than its container and may overflow on mobile (~${RESP_MOBILE_W}px).`,
              fix,
            });
          }
        }

        for (const f of findings) {
          issues.push({ ...f, nodeId: id, blockName });
        }
      }

      const flagged = new Map<string, "error" | "warn">();
      for (const i of issues) {
        const cur = flagged.get(i.nodeId);
        if (i.severity === "error" || !cur) flagged.set(i.nodeId, i.severity);
      }
      setResult({
        issues,
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warn").length,
        flagged,
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [serialized, query, breakpoint]);

  return result;
};
