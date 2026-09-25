/**
 * Renderer environment configuration. Server-only (never import from a Client
 * Component). Reads at call time so the orchestrator's runtime env wins.
 */

/** Origin of the internal API the renderer reads published data from. */
export function internalApiUrl(): string {
  return process.env.INTERNAL_API_URL?.replace(/\/$/, "") || "http://localhost:3001";
}

/** ISR revalidation window (seconds) used as the route segment default. */
export function isrRevalidateSeconds(): number {
  const raw = process.env.RENDERER_ISR_REVALIDATE;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 60;
}

/** Shared secret the API presents when calling the on-demand revalidate route. */
export function revalidateSecret(): string | undefined {
  return process.env.REVALIDATE_SECRET || undefined;
}

/** Redis connection — mirrors the API's REDIS_HOST/PORT/PASSWORD convention. */
export function redisConfig(): {
  host: string;
  port: number;
  password?: string;
} {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

/** Master toggle for the Redis cache layer (off → fall back to Next data cache). */
export function redisEnabled(): boolean {
  return process.env.RENDERER_REDIS_CACHE !== "false";
}
