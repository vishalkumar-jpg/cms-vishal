import { Trophy } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { useExperimentResults } from "../hooks/useExperiments";
import type { Experiment } from "../api/experiments.api";

/**
 * Results view (Phase 4). Per-variant exposures/conversions/rate bars, uplift vs
 * control, a two-proportion z-test confidence, and a leader call-out. Polls every
 * 15s while open.
 */
export function ResultsDialog({
  experiment,
  onClose,
}: {
  experiment: Experiment | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useExperimentResults(experiment?.id ?? null);
  if (!experiment) return null;

  const maxRate = Math.max(0.0001, ...(data?.variants ?? []).map((v) => v.rate));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Results — {experiment.name}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {data && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                Exposures: <strong className="text-foreground">{data.totalExposures}</strong>
              </span>
              <span>
                Conversions: <strong className="text-foreground">{data.totalConversions}</strong>
              </span>
              <span>Goal: {data.goalType}</span>
            </div>

            <div className="flex flex-col gap-3">
              {data.variants.map((v) => {
                const isLeader = v.variantId === data.leaderVariantId;
                return (
                  <div key={v.variantId} className="rounded-md border border-border p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {v.key} — {v.name}
                        </span>
                        {v.isControl && <Badge variant="muted">control</Badge>}
                        {isLeader && data.totalExposures > 0 && (
                          <Badge className="gap-1">
                            <Trophy className="h-3 w-3" /> leader
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm tabular-nums text-foreground">
                        {(v.rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary"
                        style={{ width: `${(v.rate / maxRate) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex gap-4 text-[11px] text-muted-foreground">
                      <span>{v.exposures} exposures</span>
                      <span>{v.conversions} conversions</span>
                      {v.uplift != null && (
                        <span className={v.uplift >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {v.uplift >= 0 ? "+" : ""}
                          {(v.uplift * 100).toFixed(1)}% vs control
                        </span>
                      )}
                      {v.confidence != null && (
                        <span>{(v.confidence * 100).toFixed(0)}% confidence</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {data.totalExposures === 0 && (
              <p className="text-sm text-muted-foreground">
                No exposures yet. Start the experiment and traffic will populate these bars.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
