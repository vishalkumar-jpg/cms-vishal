import * as React from "react";
import { FlaskConical } from "lucide-react";
import { Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeExperiment } from "@ob-cms/block-schema";
import { useExperiments } from "@/views/experiments/hooks/useExperiments";
import { useChildNodeIds, useNodeDynamic, useSetExperiment } from "./useNodeBinding";

/**
 * Experiment authoring panel (Content tab, shown only for an Experiment node).
 * Attach a site experiment and map each direct child subtree (a "variant") to a
 * variant key (A/B/…). The renderer picks ONE child by the visitor's assigned
 * variant; the block's editor switcher lets the author edit each in place. The
 * mapping is written to the node's `custom.experiment` (hoisted on save).
 */
export const ExperimentControls: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const { data: experiments = [] } = useExperiments();
  const { experiment } = useNodeDynamic(nodeId);
  const setExperiment = useSetExperiment(nodeId);
  const childIds = useChildNodeIds(nodeId);

  const experimentId = experiment?.experimentId;
  const attached = experiments.find((e) => e.id === experimentId);

  // The variant keys available from the attached experiment (fallback A/B/…).
  const availableKeys = attached
    ? attached.variants.map((v) => v.key)
    : childIds.map((_, i) => String.fromCharCode(65 + i));

  const variantKeys = experiment?.variantKeys ?? [];

  const setKeyForChild = (childIndex: number, key: string): void => {
    const next = [...variantKeys];
    while (next.length < childIds.length) next.push(String.fromCharCode(65 + next.length));
    next[childIndex] = key;
    setExperiment({ experimentId, variantKeys: next.slice(0, childIds.length) });
  };

  const attach = (id: string): void => {
    const exp = experiments.find((e) => e.id === id);
    // Seed each child subtree with the experiment's variant keys in order.
    const keys = childIds.map((_, i) => exp?.variants[i]?.key ?? String.fromCharCode(65 + i));
    setExperiment({ experimentId: id, variantKeys: keys });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs font-medium">A/B Experiment</Label>
      </div>

      {experiments.length > 0 ? (
        <Select value={experimentId ?? ""} onValueChange={attach}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Attach an experiment…" />
          </SelectTrigger>
          <SelectContent>
            {experiments.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} ({e.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No experiments yet — create one under Insights → Experiments, then attach it here.
        </p>
      )}

      {experimentId && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-muted-foreground">
            Map each child block to a variant. Add one child per variant, then use the block's
            variant switcher on the canvas to author each.
          </p>
          {childIds.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Drop one block per variant inside this Experiment.
            </p>
          ) : (
            childIds.map((cid, i) => (
              <div key={cid} className="flex items-center gap-2">
                <span className="w-16 text-[11px] text-muted-foreground">Child {i + 1}</span>
                <Select
                  value={variantKeys[i] ?? availableKeys[i] ?? ""}
                  onValueChange={(v) => setKeyForChild(i, v)}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Variant…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        Variant {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
