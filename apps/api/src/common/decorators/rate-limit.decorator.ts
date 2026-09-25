import { SetMetadata } from "@nestjs/common";

/** How a rate-limit bucket key is derived from a request. */
export type RateLimitKeyBy = "ip" | "tenant" | "ip+tenant";

export interface RateLimitOptions {
  /** Sliding window length in seconds. */
  window: number;
  /** Max requests permitted per window per key. */
  max: number;
  /** What the bucket is partitioned by (default: ip). */
  keyBy?: RateLimitKeyBy;
  /**
   * Optional stable name for the bucket (defaults to `<Controller>.<handler>`).
   * Use to share one budget across several handlers (e.g. all auth mutations).
   */
  name?: string;
}

/** Metadata key carrying the per-handler/controller rate-limit policy. */
export const RATE_LIMIT_KEY = "rateLimit";

/**
 * Declarative Redis-backed rate limit (WAVE4b). Applied by {@link RateLimitGuard}
 * (a global guard) using an atomic INCR+EXPIRE fixed window. Fails OPEN if Redis
 * is unreachable so a cache blip never hard-blocks legitimate traffic.
 *
 *   @RateLimit({ window: 60, max: 10, keyBy: "ip" })
 *
 * Limits are env-overridable per bucket name — see {@link rateLimitConfig}.
 *
 * Pass an array to enforce several buckets on one handler (e.g. AI generate is
 * capped per-minute AND per-month per tenant).
 */
export const RateLimit = (
  opts: RateLimitOptions | RateLimitOptions[],
): MethodDecorator & ClassDecorator => SetMetadata(RATE_LIMIT_KEY, opts);
