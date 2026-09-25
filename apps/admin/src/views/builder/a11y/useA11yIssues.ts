import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  runA11yChecks,
  scoreIssues,
  type A11yIssue,
  type A11yNodeInfo,
  type A11yScore,
} from "./checks";

/**
 * Live a11y issue computation for the current page. Walks Craft's node tree in
 * document order, reads each node's props (alt / heading level / link text /
 * href / button label) and its real DOM (resolved text color + background +
 * font-size via `getComputedStyle`, which yields concrete `rgb(...)` even when
 * the authored value is a `hsl(var(--token))`). Runs the pure checks and scores.
 *
 * Recomputed (debounced) whenever the serialized layout changes, so the panel
 * and markers stay in sync as the user edits.
 */

const HEADING_BLOCKS = new Set(["Heading", "Section Heading"]);
const TEXT_BLOCKS = new Set(["Heading", "Paragraph", "Text", "Link", "Button", "Section Heading"]);

/** Walk up the DOM to the nearest ancestor with a non-transparent background. */
const resolveBg = (el: HTMLElement): string => {
  let node: HTMLElement | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg)) {
      return bg;
    }
    node = node.parentElement;
  }
  return "rgb(255, 255, 255)";
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export interface A11yResult {
  issues: A11yIssue[];
  score: A11yScore;
  /** Map nodeId -> highest-severity flag for marker rendering. */
  flagged: Map<string, "error" | "warn">;
}

const EMPTY: A11yResult = {
  issues: [],
  score: { score: 100, errors: 0, warnings: 0, grade: "A" },
  flagged: new Map(),
};

export const useA11yIssues = (): A11yResult => {
  // A serialized snapshot drives recomputation; cheap string compare in effect.
  const { serialized } = useEditor((_, q) => ({ serialized: q.serialize() }));
  const { query } = useEditor();
  const [result, setResult] = React.useState<A11yResult>(EMPTY);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      const infos: A11yNodeInfo[] = [];
      let nodeMap: Record<string, unknown> = {};
      try {
        nodeMap = JSON.parse(serialized) as Record<string, unknown>;
      } catch {
        return;
      }
      // Document order: Craft serialize preserves insertion; build a DFS order
      // from ROOT for stable heading sequencing.
      const order: string[] = [];
      const visit = (id: string): void => {
        if (order.includes(id)) return;
        order.push(id);
        const n = nodeMap[id] as { nodes?: string[] } | undefined;
        for (const child of n?.nodes ?? []) visit(child);
      };
      visit("ROOT");

      for (const id of order) {
        if (id === "ROOT") continue;
        let blockName = "";
        let props: Record<string, unknown> = {};
        let dom: HTMLElement | null = null;
        try {
          const craftNode = query.node(id).get();
          blockName = craftNode.data.displayName || craftNode.data.name || "";
          props = craftNode.data.props as Record<string, unknown>;
          dom = (craftNode.dom as HTMLElement | null) ?? null;
        } catch {
          continue;
        }

        const info: A11yNodeInfo = { nodeId: id, blockName };

        if (blockName === "Image") {
          info.isImage = true;
          info.alt = str(props["altText"]);
        }
        if (HEADING_BLOCKS.has(blockName)) {
          info.headingLevel = num(props["level"]) ?? 2;
          info.text = str(props["text"]) ?? str(props["title"]);
        }
        if (blockName === "Link") {
          info.href = str(props["url"]) ?? "";
          info.text = str(props["text"]);
        }
        if (blockName === "Button") {
          info.text = str(props["label"]);
          info.href = str(props["url"]);
        }
        if (!info.text && TEXT_BLOCKS.has(blockName)) {
          info.text = str(props["text"]) ?? (dom ? dom.textContent : null);
        }

        // Resolve contrast inputs from the live DOM when present.
        if (dom && (info.text || info.headingLevel)) {
          const cs = getComputedStyle(dom);
          info.textColor = cs.color;
          info.bgColor = resolveBg(dom);
          info.fontSizePx = parseFloat(cs.fontSize) || 16;
          info.bold = parseInt(cs.fontWeight, 10) >= 600;
          if (!info.text) info.text = dom.textContent;
        }

        infos.push(info);
      }

      const issues = runA11yChecks(infos);
      const score = scoreIssues(issues);
      const flagged = new Map<string, "error" | "warn">();
      for (const i of issues) {
        const cur = flagged.get(i.nodeId);
        if (i.severity === "error" || !cur) flagged.set(i.nodeId, i.severity);
      }
      setResult({ issues, score, flagged });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [serialized, query]);

  return result;
};
