import type { Job } from "bullmq";
import type { Redis } from "ioredis";

export interface SitemapRebuildJobData {
  siteId: string;
}

/**
 * Sitemap "rebuild" after a publish (debounced by the API: jobId
 * `sitemap:<siteId>` coalesces bursts + 5s delay). The sitemap XML is built
 * on-demand by SeoService and cached in Redis under `sitemap:<siteId>`
 * (1h TTL) — so a rebuild is simply dropping that key: the next
 * /sitemap.xml request regenerates from the current published set.
 *
 * NOTE: this queue was enqueued by every publish since WAVE2b but had no
 * consumer — sitemaps went stale for up to the full TTL after publishing.
 */
export async function processSitemapRebuild(
  job: Job<SitemapRebuildJobData>,
  redis: Redis,
): Promise<{ purged: number }> {
  const { siteId } = job.data;
  const purged = await redis.del(`sitemap:${siteId}`);
  return { purged };
}
