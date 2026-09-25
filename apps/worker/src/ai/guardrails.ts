import type { Redis } from "ioredis";

/**
 * Cost & abuse guardrails backed by Redis (WAVE4a).
 *
 *  - Per-tenant rate limit: a sliding monthly window of total generations is too
 *    coarse for abuse; we use a short-window request counter (per minute) plus a
 *    monthly token/cost ceiling. Both are keyed by siteId.
 *  - Monthly ceiling: accumulate tokensIn+tokensOut and cost (micro-USD) per
 *    site per calendar month; reject new generations once either cap is hit.
 *
 * The worker enforces these at the start of a job (rate) and updates totals
 * after a successful generation (usage). Counts auto-expire so no cleanup job is
 * needed.
 */

const RATE_PER_MIN = Number(process.env.AI_RATE_PER_MIN ?? "10");
const MONTHLY_TOKEN_CEILING = Number(process.env.AI_MONTHLY_TOKEN_CEILING ?? "5000000"); // 5M tokens
const MONTHLY_COST_CEILING_MICRO = Number(process.env.AI_MONTHLY_COST_CEILING_MICRO ?? "50000000"); // $50

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface GuardrailDecision {
  allowed: boolean;
  reason?: string;
}

/** Check (and increment) the per-minute rate limit + monthly ceilings for a site. */
export async function checkGuardrails(redis: Redis, siteId: string): Promise<GuardrailDecision> {
  // 1. Per-minute rate limit (fixed window).
  const rateKey = `ai:rate:${siteId}:${Math.floor(Date.now() / 60_000)}`;
  const count = await redis.incr(rateKey);
  if (count === 1) await redis.expire(rateKey, 120);
  if (count > RATE_PER_MIN) {
    return { allowed: false, reason: `Rate limit exceeded (${RATE_PER_MIN}/min).` };
  }

  // 2. Monthly token + cost ceilings (read-only check; usage recorded post-run).
  const m = monthKey();
  const [tokensStr, costStr] = await redis.mget(
    `ai:usage:tokens:${siteId}:${m}`,
    `ai:usage:cost:${siteId}:${m}`,
  );
  const tokens = Number(tokensStr ?? "0");
  const cost = Number(costStr ?? "0");
  if (tokens >= MONTHLY_TOKEN_CEILING) {
    return { allowed: false, reason: "Monthly token ceiling reached." };
  }
  if (cost >= MONTHLY_COST_CEILING_MICRO) {
    return { allowed: false, reason: "Monthly cost ceiling reached." };
  }
  return { allowed: true };
}

/** Record token + cost usage for a site after a generation (35-day TTL). */
export async function recordUsage(
  redis: Redis,
  siteId: string,
  tokens: number,
  costMicroUsd: number,
): Promise<void> {
  const m = monthKey();
  const tokKey = `ai:usage:tokens:${siteId}:${m}`;
  const costKey = `ai:usage:cost:${siteId}:${m}`;
  const ttl = 35 * 24 * 3600;
  await redis.incrby(tokKey, Math.max(0, Math.round(tokens)));
  await redis.expire(tokKey, ttl);
  await redis.incrby(costKey, Math.max(0, Math.round(costMicroUsd)));
  await redis.expire(costKey, ttl);
}
