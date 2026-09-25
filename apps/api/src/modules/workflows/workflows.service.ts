import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  workflowActions,
  workflowRuns,
  workflows,
  type WorkflowActionRow,
  type WorkflowRow,
  type WorkflowRunRow,
  type WorkflowTriggerType,
} from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { QueueService } from "@modules/queue/queue.service";
import { generateKSUIDWithPrefixSync } from "@utils/ksuid.utils";
import type { WorkflowDto, WorkflowStatusDto } from "./dto/workflows.dto";

export interface WorkflowWithActions extends WorkflowRow {
  actions: WorkflowActionRow[];
}

/** A subject to run a workflow against (a visitor + optional identity). */
export interface WorkflowSubject {
  visitorId: string;
  identityId?: string | null;
  subjectType?: "visitor" | "identity";
}

/**
 * Workflows service (Phase 5 — automation). Site-scoped CRUD over `workflows` +
 * ordered `workflow_actions`, lifecycle (activate/pause), a `workflow_runs`
 * reader, and a dry-run `test`. The heart is `enqueueForTrigger` — a best-effort,
 * non-invasive helper the trigger hooks (forms submit / audience-recompute /
 * profile-rebuild) call: it finds every ACTIVE workflow on the site whose
 * trigger matches, upserts a `workflow_runs` row per (workflow, subject) — the
 * unique index makes it idempotent per subject — and enqueues the executor.
 * It never throws into the caller so a workflow problem cannot break the source
 * flow. All tenant reads/writes are ScopedRepository-guarded.
 */
@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  // --- CRUD -----------------------------------------------------------------

  async list(): Promise<Array<WorkflowWithActions & { recentRuns: number }>> {
    const defs = await this.repo.db
      .select()
      .from(workflows)
      .where(this.repo.scope(workflows))
      .orderBy(desc(workflows.createdAt));
    if (defs.length === 0) return [];
    const acts = await this.repo.db
      .select()
      .from(workflowActions)
      .where(this.repo.scope(workflowActions))
      .orderBy(asc(workflowActions.order));
    const runCounts = await this.repo.db
      .select({ workflowId: workflowRuns.workflowId, n: sql<number>`count(*)::int` })
      .from(workflowRuns)
      .where(this.repo.scope(workflowRuns))
      .groupBy(workflowRuns.workflowId);
    const byWf = new Map<string, WorkflowActionRow[]>();
    for (const a of acts) {
      const arr = byWf.get(a.workflowId) ?? [];
      arr.push(a);
      byWf.set(a.workflowId, arr);
    }
    const runsByWf = new Map(runCounts.map((r) => [r.workflowId, Number(r.n)]));
    return defs.map((d) => ({
      ...d,
      actions: byWf.get(d.id) ?? [],
      recentRuns: runsByWf.get(d.id) ?? 0,
    }));
  }

  async get(id: string): Promise<WorkflowWithActions> {
    const [row] = await this.repo.db
      .select()
      .from(workflows)
      .where(this.repo.scope(workflows, eq(workflows.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Workflow not found");
    const actions = await this.repo.db
      .select()
      .from(workflowActions)
      .where(this.repo.scope(workflowActions, eq(workflowActions.workflowId, id)))
      .orderBy(asc(workflowActions.order));
    return { ...row, actions };
  }

  async create(dto: WorkflowDto, user: AuthUser): Promise<WorkflowWithActions> {
    const [row] = await this.repo.db
      .insert(workflows)
      .values({
        ...this.repo.insertDefaults(),
        name: dto.name,
        status: dto.status === "active" ? "active" : "paused",
        trigger: { type: dto.trigger.type as WorkflowTriggerType, config: dto.trigger.config ?? {} },
      })
      .returning();
    await this.replaceActions(row.id, dto);
    await this.recordAudit(user, "workflow.created", row.id, { name: dto.name });
    return this.get(row.id);
  }

  async update(id: string, dto: WorkflowDto, user: AuthUser): Promise<WorkflowWithActions> {
    const [row] = await this.repo.db
      .update(workflows)
      .set({
        name: dto.name,
        ...(dto.status ? { status: dto.status === "active" ? "active" : "paused" } : {}),
        trigger: { type: dto.trigger.type as WorkflowTriggerType, config: dto.trigger.config ?? {} },
        updatedBy: user.userId,
      })
      .where(this.repo.scope(workflows, eq(workflows.id, id)))
      .returning();
    if (!row) throw new NotFoundException("Workflow not found");
    await this.replaceActions(id, dto);
    await this.recordAudit(user, "workflow.updated", id, { name: dto.name });
    return this.get(id);
  }

  /** Replace the full action set (delete-all-then-insert, re-numbered). */
  private async replaceActions(workflowId: string, dto: WorkflowDto): Promise<void> {
    await this.repo.db
      .delete(workflowActions)
      .where(this.repo.scope(workflowActions, eq(workflowActions.workflowId, workflowId)));
    if (dto.actions.length === 0) return;
    await this.repo.db.insert(workflowActions).values(
      dto.actions.map((a, i) => ({
        ...this.repo.insertDefaults(),
        workflowId,
        order: i,
        type: a.type,
        config: a.config ?? {},
      })),
    );
  }

  async remove(id: string, user: AuthUser): Promise<{ id: string }> {
    const [row] = await this.repo.db
      .update(workflows)
      .set({ deletedAt: new Date(), updatedBy: user.userId })
      .where(this.repo.scope(workflows, eq(workflows.id, id)))
      .returning({ id: workflows.id });
    if (!row) throw new NotFoundException("Workflow not found");
    await this.repo.db
      .update(workflowActions)
      .set({ deletedAt: new Date(), updatedBy: user.userId })
      .where(this.repo.scope(workflowActions, eq(workflowActions.workflowId, id)));
    await this.recordAudit(user, "workflow.deleted", id);
    return { id: row.id };
  }

  async setStatus(id: string, dto: WorkflowStatusDto, user: AuthUser): Promise<WorkflowWithActions> {
    const [row] = await this.repo.db
      .update(workflows)
      .set({ status: dto.status === "active" ? "active" : "paused", updatedBy: user.userId })
      .where(this.repo.scope(workflows, eq(workflows.id, id)))
      .returning({ id: workflows.id });
    if (!row) throw new NotFoundException("Workflow not found");
    await this.recordAudit(user, "workflow.status_changed", id, { status: dto.status });
    return this.get(id);
  }

  // --- Runs -----------------------------------------------------------------

  async runs(workflowId: string, limit = 50): Promise<WorkflowRunRow[]> {
    // Ensure the workflow exists / is in-scope (404 otherwise).
    await this.get(workflowId);
    return this.repo.db
      .select()
      .from(workflowRuns)
      .where(this.repo.scope(workflowRuns, eq(workflowRuns.workflowId, workflowId)))
      .orderBy(desc(workflowRuns.createdAt))
      .limit(Math.min(limit, 200));
  }

  /**
   * Dry-run a workflow against a sample subject. Does NOT persist a run or fire
   * any side-effect — it returns the ordered action plan + a simulated log so
   * the admin can preview what WOULD happen. Purely descriptive.
   */
  async test(id: string, visitorId?: string): Promise<{
    workflowId: string;
    subject: { visitorId: string };
    plan: Array<{ step: number; type: string; description: string }>;
  }> {
    const wf = await this.get(id);
    const subject = visitorId || "sample-visitor";
    const plan = wf.actions.map((a, i) => ({
      step: i,
      type: a.type,
      description: describeAction(a.type, a.config ?? {}),
    }));
    return { workflowId: id, subject: { visitorId: subject }, plan };
  }

  // --- Trigger hook (best-effort, non-invasive) -----------------------------

  /**
   * The one seam trigger hooks call. Finds every ACTIVE workflow on `siteId`
   * whose trigger `type` matches (and, for form_submitted / page_visited /
   * score_threshold, whose config matches the event), upserts one run per
   * (workflow, subject) — the unique index dedupes — and enqueues the executor.
   * NEVER throws: a failure is logged and swallowed so the source flow (a form
   * submit, an audience recompute) is never disturbed.
   *
   * @param match an optional predicate over the trigger config to gate firing
   *              (e.g. only fire when trigger.config.formId === the submitted form).
   */
  async enqueueForTrigger(
    siteId: string,
    triggerType: WorkflowTriggerType,
    subject: WorkflowSubject,
    match?: (config: Record<string, unknown>) => boolean,
  ): Promise<number> {
    try {
      if (!subject.visitorId && !subject.identityId) return 0;
      const rows = await this.db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.siteId, siteId),
            eq(workflows.status, "active"),
            sql`${workflows.deletedAt} is null`,
          ),
        );
      const matching = rows.filter((w) => {
        const t = w.trigger;
        if (!t || t.type !== triggerType) return false;
        return match ? match(t.config ?? {}) : true;
      });
      if (matching.length === 0) return 0;

      const subjectId = subject.visitorId || subject.identityId || "";
      let enqueued = 0;
      for (const wf of matching) {
        const runId = await this.upsertRun(siteId, wf.id, subject, subjectId);
        if (runId) {
          await this.queue.enqueueWorkflowRun({ siteId, runId });
          enqueued += 1;
        }
      }
      return enqueued;
    } catch (err) {
      this.logger.error(`workflow trigger (${triggerType}) failed: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Upsert a run for (workflow, subject). Idempotent per subject (unique index):
   * a repeat trigger for the same subject RESETS the run to re-execute (so a
   * subject re-entering an audience re-runs the workflow). Returns the run id.
   */
  private async upsertRun(
    siteId: string,
    workflowId: string,
    subject: WorkflowSubject,
    subjectId: string,
  ): Promise<string | null> {
    const [row] = await this.db
      .insert(workflowRuns)
      .values({
        id: generateKSUIDWithPrefixSync("wrn"),
        siteId,
        workflowId,
        subjectType: subject.subjectType ?? "visitor",
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
    return row?.id ?? null;
  }

  private async recordAudit(
    actor: AuthUser,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action,
      category: "content",
      entityType: "workflow",
      entityId,
      metadata,
    });
  }
}

/** Human-readable description of an action for the dry-run plan. */
function describeAction(type: string, config: Record<string, unknown>): string {
  switch (type) {
    case "send_webhook":
      return `POST to ${String(config.url ?? "(no url)")}`;
    case "send_email":
      return `Email ${String(config.to ?? "the subject's identity")} — “${String(config.subject ?? "Notification")}”`;
    case "add_to_audience":
      return `Add subject to audience ${String(config.audienceId ?? "(none)")}`;
    case "add_tag":
      return `Tag subject “${String(config.tag ?? "(none)")}”`;
    case "adjust_score":
      return `Adjust score by ${Number(config.points ?? 0) >= 0 ? "+" : ""}${Number(config.points ?? 0)}`;
    case "wait":
      return `Wait ${Number(config.waitSeconds ?? 0)}s`;
    case "enqueue_webhook_event":
      return `Emit webhook event “${String(config.event ?? "workflow.event")}”`;
    default:
      return type;
  }
}
