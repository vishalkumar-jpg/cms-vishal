import * as React from "react";
import { History, RotateCcw, Loader2, GitCompare, ArrowLeft } from "lucide-react";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePage, usePageVersions, useRollbackPage } from "@/views/pages/hooks/usePages";
import type { PageVersion } from "@/views/pages/types";
import { VersionDiffView } from "./VersionDiffView";

/** A synthetic "Current draft" entry so users can diff any version vs. current. */
const CURRENT_ID = "__current__";

const versionLabel = (v: PageVersion): string =>
  v.label ?? (v.version != null ? `Version ${v.version}` : "Snapshot");

/**
 * Lists published version snapshots. Restores one via POST /rollback/:versionId,
 * and lets the user select two entries (any two versions, or a version vs. the
 * current draft) to see a read-only structural diff — see VersionDiffView.
 */
export const VersionHistoryDrawer: React.FC<{
  siteId: string | null;
  pageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ siteId, pageId, open, onOpenChange }) => {
  const { data: versions = [], isLoading } = usePageVersions(siteId, open ? pageId : null);
  const { data: page } = usePage(siteId, open ? pageId : null);
  const rollback = useRollbackPage(siteId);
  const confirm = useConfirm();

  // Two selected entry ids to compare (version id or CURRENT_ID).
  const [selected, setSelected] = React.useState<string[]>([]);
  const [comparing, setComparing] = React.useState(false);

  // Reset selection whenever the drawer opens/closes or the page changes.
  React.useEffect(() => {
    if (!open) {
      setSelected([]);
      setComparing(false);
    }
  }, [open, pageId]);

  const onRestore = (versionId: string): void => {
    if (!pageId) return;
    const version = versions.find((v) => v.id === versionId);
    const label = version ? versionLabel(version) : "this version";
    void (async () => {
      const ok = await confirm({
        title: `Restore ${label}?`,
        description: "Your current draft layout will be replaced with this version snapshot.",
        confirmLabel: "Restore",
        destructive: true,
      });
      if (!ok) return;
      rollback.mutate(
        { pageId, versionId },
        {
          onSuccess: () => {
            toast.success("Restored. Reload the builder to see the restored layout.");
            onOpenChange(false);
          },
          onError: () => toast.error("Rollback failed"),
        },
      );
    })();
  };

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Keep at most two; drop the oldest selection.
      const nextSel = [...prev, id];
      return nextSel.length > 2 ? nextSel.slice(1) : nextSel;
    });
  };

  const layoutFor = (id: string): { layout: SerializedLayout | null; label: string } => {
    if (id === CURRENT_ID) {
      return { layout: page?.draftLayout ?? null, label: "Current draft" };
    }
    const v = versions.find((x) => x.id === id);
    return { layout: v?.snapshot?.layout ?? null, label: v ? versionLabel(v) : "Version" };
  };

  // Order selection chronologically for a stable prev→next display: current is
  // newest; otherwise older createdAt is `prev`.
  const orderedPair = React.useMemo(() => {
    if (selected.length !== 2) return null;
    const [a, b] = selected;
    const time = (id: string): number =>
      id === CURRENT_ID
        ? Number.POSITIVE_INFINITY
        : new Date(versions.find((x) => x.id === id)?.createdAt ?? 0).getTime();
    const [prevId, nextId] = time(a as string) <= time(b as string) ? [a, b] : [b, a];
    return { prev: layoutFor(prevId as string), next: layoutFor(nextId as string) };
  }, [selected, versions, page?.draftLayout]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={comparing ? "max-w-2xl" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {comparing ? (
              <>
                <GitCompare className="h-4 w-4" /> Compare versions
              </>
            ) : (
              <>
                <History className="h-4 w-4" /> Version history
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {comparing
              ? "Read-only structural diff of the two selected snapshots."
              : "Restore a previously published snapshot, or select two entries to compare."}
          </DialogDescription>
        </DialogHeader>

        {comparing && orderedPair ? (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setComparing(false)}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to history
            </Button>
            <VersionDiffView
              prevLayout={orderedPair.prev.layout}
              nextLayout={orderedPair.next.layout}
              prevLabel={orderedPair.prev.label}
              nextLabel={orderedPair.next.label}
            />
          </div>
        ) : (
          <>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isLoading && versions.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No versions yet. Publishing creates a snapshot.
                </p>
              )}

              {/* Current draft — selectable for diffing, not restorable. */}
              {!isLoading && page?.draftLayout && (
                <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.includes(CURRENT_ID)}
                      onChange={() => toggleSelect(CURRENT_ID)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">Current draft</p>
                      <p className="text-[11px] text-muted-foreground">Unpublished working copy</p>
                    </div>
                  </div>
                </label>
              )}

              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.includes(v.id)}
                      disabled={!v.snapshot?.layout}
                      onChange={() => toggleSelect(v.id)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{versionLabel(v)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rollback.isPending}
                    onClick={() => onRestore(v.id)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-[11px] text-muted-foreground">
                {selected.length === 0
                  ? "Select two entries to compare"
                  : `${selected.length} of 2 selected`}
              </p>
              <Button
                size="sm"
                disabled={selected.length !== 2}
                onClick={() => setComparing(true)}
              >
                <GitCompare className="mr-1.5 h-3.5 w-3.5" /> Compare
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
