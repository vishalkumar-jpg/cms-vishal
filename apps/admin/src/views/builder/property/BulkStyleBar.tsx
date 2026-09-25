import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Copy, Layers, Repeat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import {
  applyStylesToSimilar,
  findSimilarStyleTargets,
  isBulkStyleTargetAllowed,
  type SimilarStyleGroup,
} from "../craft/bulkStyles";
import { useCanDesign, useReadGuardrails } from "../guardrails/useGuardrails";
import { resolvedNameOf } from "../craft/nodeOps";

/**
 * Bulk style propagation — copy the selected node's current style bag onto
 * sibling cards, repeater template peers, or all same-type blocks on the page.
 */
export const BulkStyleBar: React.FC<{
  nodeId: string;
  /** `styles` or a sub-part path like `partStyles.title`. */
  rootPath?: string;
}> = ({ nodeId, rootPath = "styles" }) => {
  const { query, actions } = useEditor();
  const readGuardrails = useReadGuardrails();
  const canDesign = useCanDesign();

  const isAllowed = React.useCallback(
    (id: string) =>
      isBulkStyleTargetAllowed(query, id, (nid) => !canDesign && readGuardrails(nid).locked === true),
    [query, canDesign, readGuardrails],
  );

  const { typeName, targets } = useEditor((_state, q) => {
    const t = resolvedNameOf(q, nodeId) ?? "Block";
    return { typeName: t, targets: findSimilarStyleTargets(q, nodeId) };
  });

  const siblingCount = targets.siblings.filter(isAllowed).length;
  const repeaterCount = targets.repeaterPeers.filter(isAllowed).length;
  const allCount = targets.allSimilar.filter(isAllowed).length;

  if (siblingCount === 0 && repeaterCount === 0 && allCount === 0) return null;

  const apply = (group: SimilarStyleGroup, count: number, label: string): void => {
    if (count === 0) return;
    const n = applyStylesToSimilar(query, actions, nodeId, group, rootPath, isAllowed);
    if (n > 0) toast.success(`${label} — updated ${n} ${n === 1 ? "block" : "blocks"}`);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2.5">
      <p className="text-[11px] font-medium leading-snug text-foreground">
        Apply this <span className="text-primary">{typeName}</span> look to matching blocks
      </p>
      <div className="flex flex-col gap-1.5">
        {siblingCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 justify-start gap-2 text-xs"
            onClick={() => apply("siblings", siblingCount, "Applied to sibling cards")}
          >
            <Copy className="h-3.5 w-3.5 shrink-0" />
            Apply to sibling cards ({siblingCount})
          </Button>
        )}
        {repeaterCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 justify-start gap-2 text-xs"
            onClick={() => apply("repeater", repeaterCount, "Applied in repeater")}
          >
            <Repeat className="h-3.5 w-3.5 shrink-0" />
            Apply to repeater items ({repeaterCount})
          </Button>
        )}
        {allCount > 0 && (
          <Button
            type="button"
            size="sm"
            className="h-8 justify-start gap-2 text-xs"
            onClick={() => apply("all", allCount, "Applied to all similar")}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            Apply to all similar ({allCount})
          </Button>
        )}
      </div>
      <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
        <Layers className="mt-0.5 h-3 w-3 shrink-0" />
        Copies colors, fonts, borders, motion, and custom CSS to each target block.
      </p>
    </div>
  );
};
