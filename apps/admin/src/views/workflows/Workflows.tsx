import * as React from "react";
import { useSiteStore } from "@/store/siteStore";
import { Badge, Button, toast } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Pause, Play, Plus } from "lucide-react";
import { useWorkflows, useWorkflowMutations } from "./hooks/useWorkflows";
import { testWorkflowRequest, type Workflow } from "./api/workflows.api";
import { WorkflowEditor } from "./components/WorkflowEditor";
import { RunsDrawer } from "./components/RunsDrawer";

const TRIGGER_LABEL: Record<string, string> = {
  form_submitted: "Form submitted",
  audience_enters: "Audience entered",
  score_threshold: "Score threshold",
  page_visited: "Page visited",
};

/**
 * Workflows (Phase 5 — automation). List workflows (name, trigger, status,
 * recent runs), a builder (trigger + ordered actions), activate/pause, a runs
 * log drawer, and a dry-run test.
 */
export const Workflows: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: workflows, isLoading } = useWorkflows();
  const { remove, setStatus } = useWorkflowMutations();
  const confirm = useConfirm();

  const [editing, setEditing] = React.useState<Workflow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [runsFor, setRunsFor] = React.useState<Workflow | null>(null);

  const runTest = async (wf: Workflow): Promise<void> => {
    try {
      const res = await testWorkflowRequest(wf.id);
      toast.success(`Dry-run: ${res.plan.length} step(s) planned`);
    } catch {
      toast.error("Dry-run failed");
    }
  };

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8 text-sm text-muted-foreground">
        Select a site to manage workflows.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Automate actions when a trigger fires — score, tag, webhook, email.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New workflow
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0 bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Trigger</th>
              <th className="px-4 py-2 font-medium">Actions</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Runs</th>
              <th className="px-4 py-2 text-right font-medium">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(workflows ?? []).map((wf) => (
              <tr key={wf.id}>
                <td className="px-4 py-2 font-medium">
                  <button className="hover:underline" onClick={() => setEditing(wf)}>
                    {wf.name}
                  </button>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {TRIGGER_LABEL[wf.trigger.type] ?? wf.trigger.type}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{wf.actions.length}</td>
                <td className="px-4 py-2">
                  <Badge variant={wf.status === "active" ? "success" : "muted"}>{wf.status}</Badge>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <button className="hover:underline" onClick={() => setRunsFor(wf)}>
                    {wf.recentRuns ?? 0}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => runTest(wf)}>
                      Test
                    </Button>
                    {wf.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatus.mutate({ id: wf.id, status: "paused" })}
                      >
                        <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatus.mutate({ id: wf.id, status: "active" })}
                      >
                        <Play className="mr-1 h-3.5 w-3.5" /> Activate
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: `Delete workflow “${wf.name}”?`,
                            description: "This workflow and its run history will be removed.",
                            confirmLabel: "Delete",
                            destructive: true,
                          });
                          if (ok) remove.mutate(wf.id);
                        })();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(workflows?.length ?? 0) === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={6}>
                  {isLoading ? "Loading…" : "No workflows yet. Create one to automate your funnel."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <WorkflowEditor
          workflow={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {runsFor && <RunsDrawer workflow={runsFor} onClose={() => setRunsFor(null)} />}
    </div>
  );
};
