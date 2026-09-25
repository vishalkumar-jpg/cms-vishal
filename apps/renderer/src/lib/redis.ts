import { Redis } from "ioredis";
import { redisConfig, redisEnabled } from "./env";

/**
 * Lazy, process-wide ioredis singleton for the renderer's page/redirect/site
 * caches. `lazyConnect` so a missing Redis never breaks SSR — callers treat any
 * error as a cache miss and fall back to the origin API + Next data cache.
 *
 * Held on globalThis to survive Next dev/HMR module reloads.
 */

const GLOBAL_KEY = Symbol.for("ob-cms.renderer.redis");

interface RedisHolder {
  client: Redis | null;
  disabled: boolean;
}

function holder(): RedisHolder {
  const g = globalThis as unknown as Record<symbol, RedisHolder | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { client: null, disabled: false };
  return g[GLOBAL_KEY] as RedisHolder;
}

export function getRedis(): Redis | null {
  if (!redisEnabled()) return null;
  const h = holder();
  if (h.disabled) return null;
  if (h.client) return h.client;
  try {
    const client = new Redis({
      ...redisConfig(),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    // Swallow connection errors — cache is best-effort, never fatal.
    client.on("error", () => {
      /* no-op: treated as cache miss */
    });
    h.client = client;
    return client;
  } catch {
    h.disabled = true;
    return null;
  }
}

/** Best-effort GET. Returns null on miss or any Redis failure. */
export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

/** Best-effort SET with TTL (seconds). Silently ignores failures. */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    if (ttlSeconds > 0) await client.set(key, value, "EX", ttlSeconds);
    else await client.set(key, value);
  } catch {
    /* ignore */
  }
}

/** Best-effort DEL of one or many keys (supports glob via SCAN). */
export async function cacheDel(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    if (pattern.includes("*")) {
      const stream = client.scanStream({ match: pattern, count: 200 });
      const pipeline = client.pipeline();
      for await (const keys of stream) {
        for (const k of keys as string[]) pipeline.del(k);
      }
      await pipeline.exec();
    } else {
      await client.del(pattern);
    }
  } catch {
    /* ignore */
  }
}
