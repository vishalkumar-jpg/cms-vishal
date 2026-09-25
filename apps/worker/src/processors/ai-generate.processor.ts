import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { db } from "../db/db";
import { aiGenerationJobs } from "../db/schema";
import { runGeneration } from "../ai/generation.service";
import { checkGuardrails, recordUsage } from "../ai/guardrails";

export interface AiGenerateJobData {
  jobId: string;
  siteId: string;
  actorId: string;
}

/**
 * AI page-generation processor (WAVE4a). Postgres `ai_generation_jobs` is the
 * source of truth — only ids travel through Redis, so no prompt/secret is held
 * in the queue. Flow:
 *
 *   load row → guardrail check (rate + monthly ceiling) → mark running →
 *   runGeneration (decrypt key → ground prompt → generate → validate/repair →
 *   self-correct once → upsert DRAFT page) → mark succeeded (+ result/usage),
 *   else mark failed with the error.
 *
 * No BullMQ auto-retry (attempts:1) — generation re-bills the tenant's key, so
 * the only retry is the internal self-correction inside runGeneration.
 */
export async function processAiGenerate(
  job: Job<AiGenerateJobData>,
  redis: Redis,
): Promise<{ ok: boolean; targetPageId?: string }> {
  const { jobId, actorId } = job.data;

  const [row] = await db
    .select()
    .from(aiGenerationJobs)
    .where(eq(aiGenerationJobs.id, jobId))
    .limit(1);
  if (!row) return { ok: false };
  if (row.status === "succeeded") return { ok: true, targetPageId: row.targetPageId ?? undefined };

  // Guardrail: per-minute rate + monthly token/cost ceiling (Redis).
  const decision = await checkGuardrails(redis, row.siteId);
  if (!decision.allowed) {
    await markFailed(jobId, decision.reason ?? "Blocked by guardrail.");
    return { ok: false };
  }

  await db.update(aiGenerationJobs).set({ status: "running" }).where(eq(aiGenerationJobs.id, jobId));

  try {
    const result = await runGeneration(row, actorId);
    await db
      .update(aiGenerationJobs)
      .set({
        status: "succeeded",
        resultLayout: result.layout as unknown,
        targetPageId: result.targetPageId,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costEstimateMicroUsd: result.costMicroUsd,
        error: null,
      })
      .where(eq(aiGenerationJobs.id, jobId));

    await recordUsage(redis, row.siteId, result.tokensIn + result.tokensOut, result.costMicroUsd);
    return { ok: true, targetPageId: result.targetPageId };
  } catch (err) {
    await markFailed(jobId, (err as Error).message.slice(0, 2000));
    return { ok: false };
  }
}

async function markFailed(jobId: string, error: string): Promise<void> {
  await db
    .update(aiGenerationJobs)
    .set({ status: "failed", error })
    .where(eq(aiGenerationJobs.id, jobId));
}
