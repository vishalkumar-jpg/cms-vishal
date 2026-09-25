import type { Queue } from "bullmq";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { workflowRuns, workflows } from "./schema";
import { generateKSUIDWithPrefixSync } from "./ksuid";
import { WORKFLOW_JOBS } from "../queue-names";

/**
 * Worker-side workflow trigger enqueue (Phase 5). Mirrors the API's
 * WorkflowsService.enqueueForTrigger so the worker's audience-recompute /
 * profile-rebuild hooks can best-effort start workflow runs WITHOUT importing
 * NestJS code. Finds every ACTIVE workflow of the given type (optionally gated
 * by a config match), upserts one run per (workflow, subject) — the unique
 * index dedupes/resets per subject — and enqueues the executor.
 *
 * NEVER throws: a failure is logged + swallowed so the source job (the
 * recompute / rebuild) is never disturbed. Best-effort by design.
 */
export async function enqueueWorkflowRuns(
  queue: Queue,
  siteId: string,
  triggerType: string,
  subjects: Array<{ visitorId: string; identityId?: string | null }>,
  match?: (config: Record<string, unknown>) => boolean,
): Promise<number> {
  if (subjects.length === 0) return 0;
  try {
    const rows = await db
      .select()
      .from(workflows)
      .where(
        and(eq(workflows.siteId, siteId), eq(workflows.status, "active"), isNull(workflows.deletedAt)),
      );
    const matching = rows.filter((w) => {
      const t = w.trigger as { type?: string; config?: Record<string, unknown> } | null;
      if (!t || t.type !== triggerType) return false;
      return match ? match(t.config ?? {}) : true;
    });
    if (matching.length === 0) return 0;

    let enqueued = 0;
    for (const wf of matching) {
      for (const subject of subjects) {
        const subjectId = subject.visitorId || subject.identityId || "";
        if (!subjectId) continue;
        const [run] = await db
          .insert(workflowRuns)
          .values({
            id: generateKSUIDWithPrefixSync("wrn"),
            siteId,
            workflowId: wf.id,
            subjectType: "visitor",
            subjectId,
            status: "pending",
            stepIndex: 0,
            runAt: new Date(),
            log: [],
          })
          .onConflictDoUpdate({
            target: [workflowRuns.workflowId, workflowRuns.subjectId],
            set: {
              status: "pending",
              stepIndex: 0,
              runAt: new Date(),
              startedAt: null,
              finishedAt: null,
              log: [],
              updatedAt: new Date(),
            },
          })
          .returning({ id: workflowRuns.id });
        if (run?.id) {
          await queue.add(WORKFLOW_JOBS.EXECUTE, { siteId, runId: run.id }, {
            jobId: `workflow-run:${run.id}`,
          });
          enqueued += 1;
        }
      }
    }
    return enqueued;
  } catch (err) {
    console.error(`[worker:workflow-trigger] ${triggerType} enqueue failed`, (err as Error).message);
    return 0;
  }
}
