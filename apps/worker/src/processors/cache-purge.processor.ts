import type { Job } from "bullmq";
import type { Redis } from "ioredis";

export interface CachePurgeJobData {
  siteId: string;
  entity: "page" | "post" | "chrome" | "reusable-block" | "collection";
  entityId: string;
  slug: string;
}

/**
 * Renderer cache purge after a publish (WAVE3b §C wiring). Clears the public
 * render API's `render:<siteId>:*` keys so a publish is reflected immediately:
 * the site envelope, navigation, redirect lookups, and the specific page key.
 * Best-effort — Redis is a cache, not the source of truth.
 *
 * Also calls the renderer's POST /api/revalidate (guarded, short timeout).
 * The direct Redis deletes above only cover the API's cache keys — the
 * renderer keeps its OWN key scheme (`nav:<siteId>`, `render:<siteId>:<path>`,
 * see apps/renderer/src/lib/cache-keys.ts) AND Next.js ISR entries that only
 * `revalidateTag`/`revalidatePath` can invalidate. Without this call a publish
 * is only guaranteed live once the renderer's 60s ISR window lapses — and not
 * at all for a separately-deployed renderer.
 */
export async function processCachePurge(job: Job<CachePurgeJobData>, redis: Redis): Promise<{ purged: number }> {
  const { siteId, slug } = job.data;
  let purged = 0;

  // Targeted page key (mirrors PublicRenderService.pathToSlug: "/" → "home").
  const pageSlug = slug === "" || slug === "/" || slug === "index" ? "home" : slug.replace(/^\/+/, "");
  purged += await redis.del(`render:${siteId}:page:${pageSlug}`);
  purged += await redis.del(`render:${siteId}:site`);
  purged += await redis.del(`render:${siteId}:nav`);
  // The sitemap lists every published page/post — drop it on any content change.
  purged += await redis.del(`sitemap:${siteId}`);

  // Sweep any remaining render:<siteId>:* keys (redirects etc.) in batches.
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `render:${siteId}:*`, "COUNT", 200);
    cursor = next;
    if (keys.length > 0) purged += await redis.del(...keys);
  } while (cursor !== "0");

  await triggerRendererRevalidate(siteId, pageSlug);

  return { purged };
}

/**
 * POST the renderer's on-demand revalidation endpoint. `purgeAll` + `purgeSite`
 * is a deliberate sledgehammer: the job payload only carries the LEAF slug (a
 * nested page's public path is its ancestor chain, unknown here), so targeted
 * path purges could miss — dropping the site's render entries and revalidating
 * the catch-all layout guarantees the publish is live. Publishes are
 * low-volume; correctness beats cache thrift. Fail-soft: never throws into the
 * purge job.
 */
async function triggerRendererRevalidate(siteId: string, pageSlug: string): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return; // not configured — skip quietly (matches renderer fail-closed auth).
  const base = (process.env.RENDERER_INTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");
  const path = pageSlug === "home" ? "/" : `/${pageSlug}`;
  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ siteId, paths: [path], purgeSite: true, purgeAll: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[worker:cache-purge] renderer revalidate responded ${res.status}`);
    }
  } catch (err) {
    console.error(
      `[worker:cache-purge] renderer revalidate failed (renderer down?)`,
      (err as Error).message,
    );
  }
}
