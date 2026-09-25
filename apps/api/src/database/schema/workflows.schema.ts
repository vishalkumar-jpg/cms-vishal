import { index, integer, jsonb, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * Phase 5 — Workflows / automation. A `workflow` binds a single TRIGGER
 * (audience_enters | form_submitted | score_threshold | page_visited) to an
 * ordered list of `workflow_actions` (send_webhook, send_email, add_to_audience,
 * add_tag, adjust_score, wait, enqueue_webhook_event). Best-effort trigger hooks
 * (in the forms submit + audience-recompute + profile-rebuild paths) enqueue a
 * `workflow_run` per matching subject; the worker executor advances the run
 * step-by-step (respecting `wait`) and appends a `log`. Tenant-private.
 */

/** The four supported trigger kinds. */
export const WORKFLOW_TRIGGERS = [
  "audience_enters",
  "form_submitted",
  "score_threshold",
  "page_visited",
] as const;
export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGERS)[number];

/** The supported action kinds (executed by the worker step-by-step). */
export const WORKFLOW_ACTION_TYPES = [
  "send_webhook",
  "send_email",
  "add_to_audience",
  "add_tag",
  "adjust_score",
  "wait",
  "enqueue_webhook_event",
] as const;
export type WorkflowActionType = (typeof WORKFLOW_ACTION_TYPES)[number];

export const WORKFLOW_STATUSES = ["active", "paused"] as const;
export const WORKFLOW_RUN_STATUSES = ["pending", "running", "completed", "failed", "waiting"] as const;
export const WORKFLOW_SUBJECT_TYPES = ["visitor", "identity"] as const;

/** `workflows` (prefix `wkf`) — a trigger + status. Actions live in a child table. */
export const workflows = obCmsSchema.table(
  "workflows",
  {
    ...baseColumns("wkf"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    /** active | paused — paused workflows never enqueue or advance runs. */
    status: varchar({ length: 20 }).notNull().default("paused"),
    /**
     * The trigger: `{ type, config }`. config is trigger-specific:
     *  audience_enters → { audienceId }; form_submitted → { formId? };
     *  score_threshold → { threshold }; page_visited → { path }.
     */
    trigger: jsonb().$type<{ type: WorkflowTriggerType; config?: Record<string, unknown> }>().notNull(),
  },
  (t) => [
    index("wkf_site_idx").on(t.siteId),
    index("wkf_site_status_idx").on(t.siteId, t.status),
  ],
);

/** `workflow_actions` (prefix `wac`) — an ordered step with a typed config. */
export const workflowActions = obCmsSchema.table(
  "workflow_actions",
  {
    ...baseColumns("wac"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    workflowId: varchar({ length: 50 })
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    /** Execution order (0-based). */
    order: integer().notNull().default(0),
    /** send_webhook | send_email | add_to_audience | add_tag | adjust_score | wait | enqueue_webhook_event */
    type: varchar({ length: 40 }).notNull(),
    /** Action-specific config (url, email, audienceId, points, waitSeconds, …). */
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("wac_site_workflow_idx").on(t.siteId, t.workflowId)],
);

/**
 * `workflow_runs` (prefix `wrn`) — one run per (workflow, subject) firing. Used
 * for auditability + dedupe: the executor advances `stepIndex`/`status`, appends
 * to `log`, and sets `runAt` for a `wait`. A unique index on
 * (workflow, subjectId) makes matching triggers idempotent per subject.
 */
export const workflowRuns = obCmsSchema.table(
  "workflow_runs",
  {
    ...baseColumns("wrn"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    workflowId: varchar({ length: 50 })
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    /** visitor | identity */
    subjectType: varchar({ length: 20 }).notNull().default("visitor"),
    /** The visitorId (or identity id) the run is executing against. */
    subjectId: varchar({ length: 60 }).notNull(),
    /** pending | running | waiting | completed | failed */
    status: varchar({ length: 20 }).notNull().default("pending"),
    /** The next action index to execute (0-based). */
    stepIndex: integer().notNull().default(0),
    /** When the executor may next pick this run up (for `wait`; else now). */
    runAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    /** Append-only step log: `[{ at, step, type, ok, detail }]`. */
    log: jsonb()
      .$type<Array<{ at: string; step: number; type: string; ok: boolean; detail?: string }>>()
      .notNull()
      .default([]),
  },
  (t) => [
    index("wrn_site_workflow_idx").on(t.siteId, t.workflowId),
    index("wrn_status_runat_idx").on(t.status, t.runAt),
    uniqueIndex("wrn_workflow_subject_uidx").on(t.workflowId, t.subjectId),
  ],
);

export type WorkflowRow = typeof workflows.$inferSelect;
export type NewWorkflowRow = typeof workflows.$inferInsert;
export type WorkflowActionRow = typeof workflowActions.$inferSelect;
export type NewWorkflowActionRow = typeof workflowActions.$inferInsert;
export type WorkflowRunRow = typeof workflowRuns.$inferSelect;
export type NewWorkflowRunRow = typeof workflowRuns.$inferInsert;
