import * as React from "react";
import { useEditor } from "@craftjs/core";
import { ChevronDown, ChevronUp, Replace, Search, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useCollabStore } from "../store/collabStore";
import {
  findMatches,
  replaceInValue,
  totalOccurrences,
  type CraftNodeLike,
  type Match,
} from "./findReplace";

/**
 * Find & Replace panel (pure client). Scans the current Craft layout's TEXT
 * props for matches, navigates between them (selecting/scrolling to the node),
 * and replaces via Craft `setProp` so autosave + undo work. Opened with Ctrl/
 * Cmd+F (scoped to the builder) or the toolbar button.
 */
export const FindReplacePanel: React.FC = () => {
  const open = useCollabStore((s) => s.findOpen);
  const setOpen = useCollabStore((s) => s.setFindOpen);

  const [term, setTerm] = React.useState("");
  const [replacement, setReplacement] = React.useState("");
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [wholeWord, setWholeWord] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const findRef = React.useRef<HTMLInputElement | null>(null);

  const { nodes, actions, query } = useEditor((state) => ({ nodes: state.nodes }));

  // Re-scan whenever the term/toggles change or the tree mutates. We read the
  // live node map from Craft (props are the source of truth).
  const matches: Match[] = React.useMemo(() => {
    const map = nodes as unknown as Record<string, CraftNodeLike>;
    return findMatches(map, term, caseSensitive, wholeWord);
  }, [nodes, term, caseSensitive, wholeWord]);

  const occurrences = totalOccurrences(matches);

  React.useEffect(() => {
    if (open) setTimeout(() => findRef.current?.focus(), 0);
  }, [open]);

  React.useEffect(() => {
    setActive(0);
  }, [term, caseSensitive, wholeWord]);

  const gotoMatch = React.useCallback(
    (index: number) => {
      if (matches.length === 0) return;
      const wrapped = ((index % matches.length) + matches.length) % matches.length;
      setActive(wrapped);
      const m = matches[wrapped];
      try {
        actions.selectNode(m.nodeId);
        const dom = query.node(m.nodeId).get()?.dom;
        dom?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* node gone */
      }
    },
    [matches, actions, query],
  );

  const next = (): void => gotoMatch(active + 1);
  const prev = (): void => gotoMatch(active - 1);

  const replaceCurrent = (): void => {
    if (matches.length === 0) return;
    const m = matches[active];
    const nextVal = replaceOneOccurrence(m.value, term, replacement, caseSensitive, wholeWord);
    actions.setProp(m.nodeId, (p: Record<string, unknown>) => {
      p[m.propKey] = nextVal;
    });
    // Stay near the same spot after the tree re-scans.
    setActive((a) => Math.max(0, a));
  };

  const replaceAll = (): void => {
    // Group by node so multiple props on one node are handled, then setProp once
    // per node/prop. Each setProp is its own Craft action (undoable).
    for (const m of matches) {
      const nextVal = replaceInValue(m.value, term, replacement, caseSensitive, wholeWord);
      if (nextVal === m.value) continue;
      actions.setProp(m.nodeId, (p: Record<string, unknown>) => {
        p[m.propKey] = nextVal;
      });
    }
    setActive(0);
  };

  if (!open) return null;

  return (
    <div className="fixed right-4 top-16 z-50 w-80 rounded-lg border border-border bg-card p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Search className="h-3.5 w-3.5" /> Find & Replace
        </span>
        <button
          type="button"
          className="rounded p-1 hover:bg-accent"
          onClick={() => setOpen(false)}
          title="Close (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-2 flex items-center gap-1">
        <Input
          ref={findRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Find"
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) prev();
              else next();
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <span className="w-16 shrink-0 text-center text-[11px] text-muted-foreground">
          {occurrences === 0 ? "0/0" : `${active + 1}/${matches.length}`}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-1">
        <Input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder="Replace with"
          className="h-8 text-sm"
        />
      </div>

      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Case
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
          />
          Whole word
        </label>
        <span className="ml-auto text-muted-foreground">{occurrences} match(es)</span>
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={!matches.length} onClick={prev} title="Previous (Shift+Enter)">
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" disabled={!matches.length} onClick={next} title="Next (Enter)">
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button size="sm" variant="outline" disabled={!matches.length} onClick={replaceCurrent}>
          <Replace className="mr-1 h-3.5 w-3.5" /> Replace
        </Button>
        <Button size="sm" disabled={!matches.length} onClick={replaceAll}>
          All
        </Button>
      </div>
    </div>
  );
};

/** Replace only the FIRST occurrence in a value (for the current-match Replace). */
function replaceOneOccurrence(
  value: string,
  term: string,
  replacement: string,
  caseSensitive: boolean,
  wholeWord: boolean,
): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  try {
    const re = new RegExp(pattern, caseSensitive ? "" : "i");
    return value.replace(re, replacement);
  } catch {
    return value;
  }
}
