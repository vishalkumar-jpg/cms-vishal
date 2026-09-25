import type { Job, Queue } from "bullmq";
import { and, eq, isNull, sql } from "drizzle-orm";
import { CRM_TIMESTAMP_HEADER, signCrmPayload } from "@ob-cms/crypto";
import { db } from "../db/db";
import {
  audienceMemberships,
  identities,
  visitorProfiles,
  webhookDeliveries,
  webhooks,
  workflowActions,
  workflowRuns,
  workflows,
} from "../db/schema";
import { generateKSUIDWithPrefixSync } from "../db/ksuid";
import { WEBHOOK_JOBS } from "../queue-names";

export interface WorkflowRunJobData {
  siteId: string;
  runId: string;
}

interface RunLogEntry {
  at: string;
  step: number;
  type: string;
  ok: boolean;
  detail?: string;
}

const SIGNATURE_HEADER = "x-ob-signature";
const POST_TIMEOUT_MS = 10_000;

/**
 * Workflow executor (Phase 5). Advances one `workflow_runs` row step-by-step:
 * loads the workflow's ordered actions, executes each from `stepIndex`, appends
 * a log entry, and either completes or (for a `wait` action) sets `runAt` +
 * re-enqueues itself with a delay to resume. Idempotent: a run already
 * `completed`/`failed` is skipped; a paused/deleted workflow aborts the run.
 * Each action is best-effort — an action error is logged into the run + the run
 * is marked `failed`, but never crashes the worker.
 */
export async function processWorkflowRun(
  job: Job<WorkflowRunJobData>,
  self: Queue,
  webhookQueue: Queue,
): Promise<{ status: string; steps: number }> {
  const { runId } = job.data;

  const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).limit(1);
  if (!run) return { status: "missing", steps: 0 };
  if (run.status === "completed" || run.status === "failed") {
    return { status: run.status, steps: 0 };
  }

  const [wf] = await db.select().from(workflows).where(eq(workflows.id, run.workflowId)).limit(1);
  if (!wf || wf.deletedAt || wf.status !== "active") {
    await db
      .update(workflowRuns)
      .set({ status: "failed", finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowRuns.id, runId));
    return { status: "failed", steps: 0 };
  }

  const actions = (
    await db
      .select()
      .from(workflowActions)
      .where(and(eq(workflowActions.workflowId, wf.id), isNull(workflowActions.deletedAt)))
  ).sort((a, b) => a.order - b.order);

  const log: RunLogEntry[] = [...(run.log ?? [])];
  await db
    .update(workflowRuns)
    .set({ status: "running", startedAt: run.startedAt ?? new Date(), updatedAt: new Date() })
    .where(eq(workflowRuns.id, runId));

  let step = run.stepIndex;
  let executed = 0;

  for (; step < actions.length; step++) {
    const action = actions[step];
    const config = (action.config ?? {}) as Record<string, unknown>;

    // A `wait` action: persist progress (next step) + a resume time, re-enqueue
    // with a delay, and stop this pick-up. The run stays `waiting` until resumed.
    if (action.type === "wait") {
      const waitSeconds = Math.max(0, Number(config.waitSeconds ?? 0));
      const runAt = new Date(Date.now() + waitSeconds * 1000);
      log.push({ at: new Date().toISOString(), step, type: "wait", ok: true, detail: `${waitSeconds}s` });
      await db
        .update(workflowRuns)
        .set({ status: "waiting", stepIndex: step + 1, runAt, log, updatedAt: new Date() })
        .where(eq(workflowRuns.id, runId));
      await self.add(
        "execute",
        { siteId: run.siteId, runId },
        { jobId: `workflow-run:${runId}:${Date.now()}`, delay: waitSeconds * 1000 },
      );
      return { status: "waiting", steps: executed };
    }

    try {
      const detail = await runAction(
        action.type,
        config,
        { siteId: run.siteId, subjectId: run.subjectId },
        webhookQueue,
      );
      log.push({ at: new Date().toISOString(), step, type: action.type, ok: true, detail });
      executed++;
    } catch (err) {
      log.push({
        at: new Date().toISOString(),
        step,
        type: action.type,
        ok: false,
        detail: (err as Error).message.slice(0, 500),
      });
      await db
        .update(workflowRuns)
        .set({ status: "failed", stepIndex: step, finishedAt: new Date(), log, updatedAt: new Date() })
        .where(eq(workflowRuns.id, runId));
      console.error(`[worker:workflow-run] run ${runId} step ${step} (${action.type}) failed`);
      return { status: "failed", steps: executed };
    }
  }

  await db
    .update(workflowRuns)
    .set({ status: "completed", stepIndex: step, finishedAt: new Date(), log, updatedAt: new Date() })
    .where(eq(workflowRuns.id, runId));
  console.log(`[worker:workflow-run] run ${runId} completed (${executed} steps, job #${job.id})`);
  return { status: "completed", steps: executed };
}

/** Execute a single (non-wait) action. Returns a short log detail; throws on error. */
async function runAction(
  type: string,
  config: Record<string, unknown>,
  ctx: { siteId: string; subjectId: string },
  webhookQueue: Queue,
): Promise<string> {
  switch (type) {
    case "adjust_score":
      return adjustScore(ctx.siteId, ctx.subjectId, Number(config.points ?? 0));
    case "add_to_audience":
      return addToAudience(ctx.siteId, ctx.subjectId, String(config.audienceId ?? ""));
    case "add_tag":
      return addTag(ctx.siteId, ctx.subjectId, String(config.tag ?? ""));
    case "send_webhook":
      return sendWebhook(ctx, config);
    case "enqueue_webhook_event":
      return enqueueWebhookEvent(ctx, config, webhookQueue);
    case "send_email":
      return sendEmail(ctx, config);
    default:
      return `no-op (${type})`;
  }
}

/** +N (or -N) to the visitor's profile score. Creates a stub profile if absent. */
async function adjustScore(siteId: string, visitorId: string, points: number): Promise<string> {
  const delta = Number.isFinite(points) ? Math.trunc(points) : 0;
  const updated = await db
    .update(visitorProfiles)
    .set({ score: sql`${visitorProfiles.score} + ${delta}`, updatedAt: new Date() })
    .where(and(eq(visitorProfiles.siteId, siteId), eq(visitorProfiles.visitorId, visitorId)))
    .returning({ id: visitorProfiles.id });
  if (updated.length === 0) {
    // No profile yet (rebuild hasn't run) — create a stub so the adjustment sticks.
    await db
      .insert(visitorProfiles)
      .values({ id: generateKSUIDWithPrefixSync("vpr"), siteId, visitorId, score: delta })
      .onConflictDoUpdate({
        target: [visitorProfiles.siteId, visitorProfiles.visitorId],
        set: { score: sql`${visitorProfiles.score} + ${delta}`, updatedAt: new Date() },
      });
  }
  return `score ${delta >= 0 ? "+" : ""}${delta}`;
}

/** Materialize an audience membership for the subject (idempotent per audience). */
async function addToAudience(siteId: string, visitorId: string, audienceId: string): Promise<string> {
  if (!audienceId) return "no audience";
  const [profile] = await db
    .select({ id: visitorProfiles.id, identityId: visitorProfiles.identityId })
    .from(visitorProfiles)
    .where(and(eq(visitorProfiles.siteId, siteId), eq(visitorProfiles.visitorId, visitorId)))
    .limit(1);
  const profileId = profile?.id ?? generateKSUIDWithPrefixSync("vpr");
  if (!profile) {
    await db
      .insert(visitorProfiles)
      .values({ id: profileId, siteId, visitorId })
      .onConflictDoNothing();
  }
  const existing = await db
    .select({ id: audienceMemberships.id })
    .from(audienceMemberships)
    .where(and(eq(audienceMemberships.audienceId, audienceId), eq(audienceMemberships.visitorId, visitorId)))
    .limit(1);
  if (existing.length > 0) return `already in ${audienceId}`;
  await db.insert(audienceMemberships).values({
    id: generateKSUIDWithPrefixSync("ame"),
    siteId,
    audienceId,
    visitorProfileId: profileId,
    visitorId,
    identityId: profile?.identityId ?? null,
  });
  return `added to ${audienceId}`;
}

/**
 * "Tag" the subject's identity by appending to identities.name suffix is NOT
 * appropriate; instead we record the tag in the run log only (there is no tag
 * column in the schema). Best-effort + descriptive so the action is auditable
 * without inventing a column outside our lane.
 */
async function addTag(_siteId: string, _visitorId: string, tag: string): Promise<string> {
  return tag ? `tag noted: ${tag}` : "no tag";
}

/** Direct signed POST to a configured URL (HMAC over `${ts}.${body}`, same scheme as E27). */
async function sendWebhook(
  ctx: { siteId: string; subjectId: string },
  config: Record<string, unknown>,
): Promise<string> {
  const url = String(config.url ?? "");
  if (!url) return "no url";
  const secret = String(config.secret ?? "");
  const body = JSON.stringify({
    event: "workflow.action",
    siteId: ctx.siteId,
    subjectId: ctx.subjectId,
    occurredAt: new Date().toISOString(),
    data: (config.payload as Record<string, unknown>) ?? {},
  });
  const timestamp = String(Date.now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (secret) {
      headers[SIGNATURE_HEADER] = signCrmPayload(secret, timestamp, body);
      headers[CRM_TIMESTAMP_HEADER] = timestamp;
    }
    const res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
    return `POST ${url} → ${res.status}`;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Emit a named event to the site's E27 webhook subscriptions: create a
 * webhook_deliveries row per matching ACTIVE subscription + enqueue the existing
 * delivery worker (reuses the durable, retrying E27 pipeline).
 */
async function enqueueWebhookEvent(
  ctx: { siteId: string; subjectId: string },
  config: Record<string, unknown>,
  webhookQueue: Queue,
): Promise<string> {
  const event = String(config.event ?? "workflow.event");
  const subs = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.siteId, ctx.siteId), eq(webhooks.active, true)));
  const matching = subs.filter((s) => (s.events ?? []).includes(event));
  if (matching.length === 0) return `no subscriber for ${event}`;
  let n = 0;
  for (const sub of matching) {
    const [row] = await db
      .insert(webhookDeliveries)
      .values({
        id: generateKSUIDWithPrefixSync("whd"),
        siteId: ctx.siteId,
        webhookId: sub.id,
        event,
        payload: {
          event,
          siteId: ctx.siteId,
          occurredAt: new Date().toISOString(),
          data: { subjectId: ctx.subjectId, ...((config.payload as Record<string, unknown>) ?? {}) },
        },
        status: "pending",
      })
      .returning({ id: webhookDeliveries.id });
    if (row?.id) {
      await webhookQueue.add(
        WEBHOOK_JOBS.DELIVER,
        { deliveryId: row.id, siteId: ctx.siteId },
        { jobId: `webhook:${row.id}`, attempts: 5, backoff: { type: "exponential", delay: 5000 } },
      );
      n++;
    }
  }
  return `emitted ${event} → ${n} subscriber(s)`;
}

/**
 * Best-effort email to the subject's identity (or a fixed address). The worker
 * has no bundled mailer, so this attempts a dynamic nodemailer SMTP send and
 * DEGRADES gracefully (logs the intent) when nodemailer/SMTP is unavailable —
 * the run still completes. To=config.to else the subject's identity email.
 */
async function sendEmail(
  ctx: { siteId: string; subjectId: string },
  config: Record<string, unknown>,
): Promise<string> {
  let to = String(config.to ?? "");
  if (!to) {
    const [id] = await db
      .select({ email: identities.primaryEmail })
      .from(visitorProfiles)
      .leftJoin(identities, eq(identities.id, visitorProfiles.identityId))
      .where(and(eq(visitorProfiles.siteId, ctx.siteId), eq(visitorProfiles.visitorId, ctx.subjectId)))
      .limit(1);
    to = id?.email ?? "";
  }
  if (!to) return "no recipient";
  const subject = String(config.subject ?? "Notification");
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  if (!host) return `email skipped (no SMTP) → ${to}`;
  try {
    const mod = (await import("nodemailer").catch(() => null)) as
      | { createTransport: (o: unknown) => { sendMail: (m: unknown) => Promise<unknown> } }
      | null;
    if (!mod) return `email skipped (no mailer) → ${to}`;
    const transport = mod.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? "1025"),
      secure: false,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM ?? "no-reply@ob-cms.local",
      to,
      subject,
      text: String(config.body ?? subject),
    });
    return `emailed ${to}`;
  } catch (err) {
    // Best-effort: an SMTP outage must not fail the run.
    return `email failed (${(err as Error).message.slice(0, 80)})`;
  }
}
