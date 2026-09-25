import { z } from "zod";

/**
 * Default API global prefix. Duplicated from `@ob-cms/shared` `API_GLOBAL_PREFIX`
 * intentionally — `@ob-cms/config` must not depend on `@ob-cms/shared` (turbo
 * reports a circular package dependency). Keep in sync with `constants.ts`.
 */
const DEFAULT_API_GLOBAL_PREFIX = "api/v1";

/**
 * Shared environment schema for OB-CMS.
 * Each app validates the subset it needs at boot; this is the single source of
 * truth for env var names/shapes across the monorepo.
 *
 * WAVE4b: the API enforces a dependency-free mirror of the required subset at
 * boot (apps/api/src/config/env.config.ts#assertRequiredEnv) — kept in sync with
 * this schema. Staging/production also require Redis, storage, JWT, encryption,
 * and revalidation secrets via assertDeployedEnv in env.config.ts. The root .env
 * is loaded via the walk-up loader in ./load-env.ts so a single root file powers
 * `bun run dev` for every app.
 */
export const envSchema = z.object({
  ENVIRONMENT: z.enum(["local", "development", "staging", "production"]).default("local"),

  // API
  API_PORT: z.coerce.number().default(3001),
  WORKER_PORT: z.coerce.number().default(3011),
  GLOBAL_PREFIX: z.string().default(DEFAULT_API_GLOBAL_PREFIX),
  ALLOWED_ORIGINS: z.string().default(""),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(1).default("change-me-in-production"),
  AUTH0_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Rate limiting (WAVE4b) — all optional with safe in-code defaults.
  RATE_LIMIT_ENABLED: z.enum(["true", "false"]).default("true"),
  RATE_LIMIT_GLOBAL_WINDOW: z.coerce.number().optional(),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().optional(),
  RATE_LIMIT_AUTH_WINDOW: z.coerce.number().optional(),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().optional(),
  RATE_LIMIT_FORM_WINDOW: z.coerce.number().optional(),
  RATE_LIMIT_FORM_MAX: z.coerce.number().optional(),
  RATE_LIMIT_AI_WINDOW: z.coerce.number().optional(),
  RATE_LIMIT_AI_MAX: z.coerce.number().optional(),
  RATE_LIMIT_AI_MONTHLY_MAX: z.coerce.number().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: NodeJS.ProcessEnv = process.env): Env =>
  envSchema.parse(raw);
