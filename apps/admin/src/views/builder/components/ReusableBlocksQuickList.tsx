import * as React from "react";
import { Blocks } from "lucide-react";
import { layoutHasContent } from "@ob-cms/block-schema";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import { useReusableBlocks } from "@/views/reusable-blocks/hooks/useReusableBlocks";
import { useReusableBlockInsert } from "../hooks/useReusableBlockInsert";

interface ReusableBlocksQuickListProps {
  insertIndex?: number;
  onInserted?: () => void;
}

/**
 * Compact reusable-block picker for section quick-insert (+) affordances.
 */
export const ReusableBlocksQuickList: React.FC<ReusableBlocksQuickListProps> = ({
  insertIndex,
  onInserted,
}) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: blocks = [], isLoading } = useReusableBlocks(siteId);
  const { insert, insertAt } = useReusableBlockInsert();

  if (!siteId || isLoading || blocks.length === 0) return null;

  const pick = (reusableBlockId: string, name: string, empty: boolean): void => {
    if (empty) {
      toast.warning(`“${name}” is empty. Add content in the reusable editor, then save.`);
    }
    const ok =
      insertIndex != null ? insertAt(reusableBlockId, insertIndex) : insert(reusableBlockId);
    if (ok) onInserted?.();
  };

  return (
    <div className="mt-2 border-t border-border pt-2">
      <p className="mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Blocks className="h-3 w-3" />
        Reusable blocks
      </p>
      <div className="flex flex-col gap-0.5">
        {blocks.map((b) => {
          const empty = !layoutHasContent(b.layout);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => pick(b.id, b.name, empty)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
              {empty ? (
                <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  Empty
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};
