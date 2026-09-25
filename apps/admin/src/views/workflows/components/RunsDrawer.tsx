import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { useWorkflowRuns } from "../hooks/useWorkflows";
import type { Workflow } from "../api/workflows.api";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "secondary"> = {
  completed: "success",
  running: "secondary",
  waiting: "warning",
  pending: "muted",
  failed: "destructive",
};

/** A drawer (Dialog) showing a workflow's recent runs + their step logs. */
export function RunsDrawer({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const { data: runs, isLoading } = useWorkflowRuns(workflow.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Runs — {workflow.name}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Loading runs…</p>}
        {!isLoading && (runs?.length ?? 0) === 0 && (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No runs yet. Activate the workflow and fire its trigger.
          </p>
        )}

        <div className="space-y-3">
          {(runs ?? []).map((run) => (
            <div key={run.id} className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">{run.subjectId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </div>
                <Badge variant={STATUS_VARIANT[run.status] ?? "muted"}>{run.status}</Badge>
              </div>
              <ol className="divide-y divide-border">
                {run.log.map((entry, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-1.5 text-sm">
                    <span>
                      <span className="text-muted-foreground">#{entry.step}</span> {entry.type}
                      {entry.detail ? <span className="text-muted-foreground"> — {entry.detail}</span> : null}
                    </span>
                    <span className={entry.ok ? "text-green-600" : "text-red-600"}>
                      {entry.ok ? "ok" : "fail"}
                    </span>
                  </li>
                ))}
                {run.log.length === 0 && (
                  <li className="px-3 py-1.5 text-xs text-muted-foreground">No steps logged yet.</li>
                )}
              </ol>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
