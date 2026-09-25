import { getOsEnvOptional } from "./env.config";

/**
 * Rate-limit policy (WAVE4b). All values are env-overridable so ops can tune
 * limits without a redeploy. `RATE_LIMIT_ENABLED=false` disables enforcement
 * entirely (handy for load tests); the guard then no-ops.
 *
 * Env knobs (seconds / counts):
 *   RATE_LIMIT_ENABLED            (default true)
 *   RATE_LIMIT_GLOBAL_WINDOW/MAX  global default for every /api route
 *   RATE_LIMIT_AUTH_WINDOW/MAX    strict per-IP for login/signup/forgot/reset
 *   RATE_LIMIT_FORM_WINDOW/MAX    public form submit (per ip+tenant)
 *   RATE_LIMIT_AI_WINDOW/MAX      AI generate per-minute (per tenant)
 *   RATE_LIMIT_AI_MONTHLY_MAX     AI generate per-month cap (per tenant)
 */
function num(key: string, fallback: number): number {
  const raw = getOsEnvOptional(key);
  const n = raw != null ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const SECONDS_PER_MONTH = 60 * 60 * 24 * 30;

export const rateLimitConfig = {
  enabled: getOsEnvOptional("RATE_LIMIT_ENABLED") !== "false",

  /** Sane global default applied to every route lacking a stricter @RateLimit. */
  global: {
    window: num("RATE_LIMIT_GLOBAL_WINDOW", 60),
    max: num("RATE_LIMIT_GLOBAL_MAX", 300),
  },

  /** Named buckets referenced by @RateLimit({ name }). */
  buckets: {
    auth: {
      window: num("RATE_LIMIT_AUTH_WINDOW", 60),
      max: num("RATE_LIMIT_AUTH_MAX", 10),
    },
    form: {
      window: num("RATE_LIMIT_FORM_WINDOW", 60),
      max: num("RATE_LIMIT_FORM_MAX", 10),
    },
    aiMinute: {
      window: num("RATE_LIMIT_AI_WINDOW", 60),
      max: num("RATE_LIMIT_AI_MAX", 5),
    },
    aiMonthly: {
      window: SECONDS_PER_MONTH,
      max: num("RATE_LIMIT_AI_MONTHLY_MAX", 500),
    },
  },
} as const;

export type RateLimitBucketName = keyof typeof rateLimitConfig.buckets;
