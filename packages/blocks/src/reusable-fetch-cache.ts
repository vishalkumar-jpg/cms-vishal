import type { ResolvedComponent, SerializedLayout } from "@ob-cms/block-schema";

type CacheEntry =
  | { status: "ok"; layout: SerializedLayout | null; component: ResolvedComponent | null }
  | { status: "miss" }
  | { status: "pending"; promise: Promise<CacheEntry> };

const cache = new Map<string, CacheEntry>();
const generation = new Map<string, number>();
const listeners = new Set<(id?: string) => void>();

function okEntry(
  layout: SerializedLayout | null,
  component: ResolvedComponent | null,
): CacheEntry {
  return { status: "ok", layout, component };
}

/**
 * Dedupe reusable-block fetches and remember 404s so deleted references do not
 * hammer the API (three ReusableBlock instances → one request).
 */
export async function fetchReusableBlockCached(
  id: string,
  load: () => Promise<{ layout: SerializedLayout | null; component: ResolvedComponent | null }>,
): Promise<{ layout: SerializedLayout | null; component: ResolvedComponent | null }> {
  const hit = cache.get(id);
  if (hit?.status === "ok") {
    return { layout: hit.layout, component: hit.component };
  }
  if (hit?.status === "miss") {
    return { layout: null, component: null };
  }
  if (hit?.status === "pending") {
    const resolved = await hit.promise;
    if (resolved.status === "ok") {
      return { layout: resolved.layout, component: resolved.component };
    }
    return { layout: null, component: null };
  }

  const gen = (generation.get(id) ?? 0) + 1;
  generation.set(id, gen);

  const promise = (async (): Promise<CacheEntry> => {
    try {
      const data = await load();
      if (generation.get(id) !== gen) return { status: "miss" };
      if (!data.layout) {
        cache.set(id, { status: "miss" });
        return { status: "miss" };
      }
      const entry = okEntry(data.layout, data.component);
      cache.set(id, entry);
      return entry;
    } catch {
      if (generation.get(id) !== gen) return { status: "miss" };
      cache.delete(id);
      return { status: "miss" };
    }
  })();

  cache.set(id, { status: "pending", promise });
  const resolved = await promise;
  if (resolved.status === "ok") {
    return { layout: resolved.layout, component: resolved.component };
  }
  return { layout: null, component: null };
}

/** Clear a cached id after the source block is updated/deleted. */
export function invalidateReusableBlockCache(id?: string): void {
  if (id) {
    cache.delete(id);
    generation.set(id, (generation.get(id) ?? 0) + 1);
  } else {
    cache.clear();
    for (const key of generation.keys()) {
      generation.set(key, (generation.get(key) ?? 0) + 1);
    }
  }
  for (const listener of listeners) listener(id);
}

/** Re-fetch reusable blocks when their source row is updated in the admin. */
export function subscribeReusableBlockCache(listener: (id?: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
