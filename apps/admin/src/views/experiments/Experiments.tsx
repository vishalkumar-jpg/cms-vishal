import { useState } from "react";
import { BarChart2, FlaskConical, Pause, Play, Plus, Square, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useExperiments, useExperimentMutations } from "./hooks/useExperiments";
import { ExperimentEditor } from "./components/ExperimentEditor";
import { ResultsDialog } from "./components/ResultsDialog";
import type { Experiment, ExperimentStatus } from "./api/experiments.api";

const EXPERIMENT_STATUS = {
  DRAFT: "draft",
  RUNNING: "running",
  PAUSED: "paused",
  DONE: "done",
} as const satisfies Record<string, ExperimentStatus>;

const STATUS_VARIANT: Record<ExperimentStatus, "muted" | "default"> = {
  [EXPERIMENT_STATUS.DRAFT]: "muted",
  [EXPERIMENT_STATUS.RUNNING]: "default",
  [EXPERIMENT_STATUS.PAUSED]: "muted",
  [EXPERIMENT_STATUS.DONE]: "muted",
};

/**
 * Experiments (Phase 4 A/B). List experiments (status, variants, goal, dates),
 * create/edit (name, goal, weighted variants), start/pause/stop, and a results
 * view (per-variant exposures/conversions/rate + winner call-out). Section-variant
 * experiments are authored via the builder's Experiment block.
 */
export function Experiments() {
  const { data, isLoading } = useExperiments();
  const { remove, setStatus } = useExperimentMutations();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Experiment | null>(null);
  const [creating, setCreating] = useState(false);
  const [resultsOf, setResultsOf] = useState<Experiment | null>(null);

  const transition = (experiment: Experiment, status: ExperimentStatus): void => {
    void (async () => {
      if (status === EXPERIMENT_STATUS.RUNNING) {
        const ok = await confirm({
          title: `Start "${experiment.name}"?`,
          description: "Live traffic will be split across variants according to this experiment's configuration.",
          confirmLabel: "Start",
        });
        if (!ok) return;
      } else if (status === EXPERIMENT_STATUS.PAUSED) {
        const ok = await confirm({
          title: `Pause "${experiment.name}"?`,
          description:
            "The experiment will stop actively splitting live traffic while it is paused.",
          confirmLabel: "Pause",
          destructive: true,
        });
        if (!ok) return;
      } else if (status === EXPERIMENT_STATUS.DONE) {
        const ok = await confirm({
          title: `Stop "${experiment.name}"?`,
          description: "The experiment will end and traffic will no longer be split across variants.",
          confirmLabel: "Stop",
          destructive: true,
        });
        if (!ok) return;
      }
      setStatus.mutate(
        { id: experiment.id, status },
        {
          onSuccess: () =>
            toast.success(
              `Experiment ${
                status === EXPERIMENT_STATUS.RUNNING
                  ? "started"
                  : status === EXPERIMENT_STATUS.DONE
                    ? "stopped"
                    : status === EXPERIMENT_STATUS.PAUSED
                      ? "paused"
                      : "updated"
              }`,
            ),
          onError: () => toast.error("Could not update experiment"),
        },
      );
    })();
  };

  const doDelete = (experiment: Experiment): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${experiment.name}"?`,
        description: "This experiment and its results will be permanently removed.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      remove.mutate(experiment.id, {
        onSuccess: () => toast.success("Experiment deleted"),
        onError: () => toast.error("Could not delete experiment"),
      });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <FlaskConical className="h-6 w-6 text-primary" />
            Experiments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run A/B tests with a deterministic traffic split and conversion tracking.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New experiment
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && (data ?? []).length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No experiments yet. Create one to start testing.
        </div>
      )}

      <div className="grid gap-3">
        {(data ?? []).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
          >
            <button className="text-left" onClick={() => setEditing(e)}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{e.name}</span>
                <Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge>
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {e.variants.map((v) => v.key).join(" / ")} · goal: {e.goalType}
                {e.goalPath ? ` (${e.goalPath})` : ""}
              </div>
            </button>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setResultsOf(e)}>
                <BarChart2 className="mr-1 h-3.5 w-3.5" />
                Results
              </Button>
              {e.status !== EXPERIMENT_STATUS.RUNNING && e.status !== EXPERIMENT_STATUS.DONE && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Start"
                  onClick={() => transition(e, EXPERIMENT_STATUS.RUNNING)}
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {e.status === EXPERIMENT_STATUS.RUNNING && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Pause"
                  onClick={() => transition(e, EXPERIMENT_STATUS.PAUSED)}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {(e.status === EXPERIMENT_STATUS.RUNNING || e.status === EXPERIMENT_STATUS.PAUSED) && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Stop"
                  onClick={() => transition(e, EXPERIMENT_STATUS.DONE)}
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" title={DELETE_CONFIRM_LABEL} onClick={() => doDelete(e)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <ExperimentEditor
          experiment={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ResultsDialog experiment={resultsOf} onClose={() => setResultsOf(null)} />
    </div>
  );
}
