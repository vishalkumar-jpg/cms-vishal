import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Sparkles, Plus } from "lucide-react";
import { computePageSignals, recommendNextBlocks } from "../blocks/recommendations";
import { useBlockInsert } from "../hooks/useBlockInsert";
import { useEditorUiStore } from "../store/editorUiStore";

const scheduleIdle = (cb: () => void): number => {
  if (typeof requestIdleCallback !== "undefined") {
    return requestIdleCallback(cb);
  }
  return window.setTimeout(cb, 1);
};

const cancelIdle = (id: number): void => {
  if (typeof cancelIdleCallback !== "undefined") {
    cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
};

/**
 * "Recommended next section" — rule-based suggestions shown at the top of the
 * Blocks palette. Reacts to the live Craft tree: as the page grows it always
 * proposes the next missing stage of the Hero → Features → Testimonials → CTA
 * flow. Each suggestion is both a drag source and a one-click "append to page".
 */
export const RecommendedBlocks: React.FC = () => {
  const dirtyVersion = useEditorUiStore((s) => s.dirtyVersion);
  const { query, connectors } = useEditor();
  const [recommendations, setRecommendations] = React.useState<
    ReturnType<typeof recommendNextBlocks>
  >([]);

  React.useEffect(() => {
    const idleId = scheduleIdle(() => {
      try {
        const nodes = JSON.parse(query.serialize()) as Parameters<
          typeof computePageSignals
        >[0];
        setRecommendations(recommendNextBlocks(computePageSignals(nodes)));
      } catch {
        setRecommendations([]);
      }
    });
    return () => cancelIdle(idleId);
  }, [dirtyVersion, query]);

  const { makeElement, insert } = useBlockInsert();

  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-0.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          Recommended next section
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {recommendations.map((rec) => (
          <div
            key={`${rec.block}:${rec.label}`}
            className="group flex flex-col rounded-md border border-border bg-card transition-colors hover:border-primary"
          >
            <button
              type="button"
              ref={(ref) => {
                const el = makeElement(rec.block);
                if (ref && el) connectors.create(ref, el);
              }}
              className="flex cursor-grab flex-col items-start gap-0.5 px-2.5 py-2 text-left active:cursor-grabbing"
            >
              <span className="text-xs font-semibold leading-tight">{rec.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{rec.reason}</span>
            </button>
            <div className="border-t border-border/60 px-2 pb-2 pt-1">
              <button
                type="button"
                onClick={() => insert(rec.block)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
