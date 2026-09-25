import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "../db/db";
import { pages, posts } from "../db/schema";

/**
 * CONTENT-OPS — scheduled unpublish / content expiry.
 *
 * Repeatable job (every minute) that finds PUBLISHED pages/posts whose
 * `expires_at` has passed and auto-unpublishes them:
 *   - status → "draft", workflow_state → "draft" (the symmetric inverse of the
 *     publish path — the content is preserved as a draft, not deleted),
 *   - expires_at → null (the expiry has fired; re-setting is an explicit action),
 *   - the renderer's Redis cache for the site is purged (`render:<siteId>:*`) and
 *     the cached sitemap (`sitemap:<siteId>`) is dropped so the row disappears
 *     from the public site + sitemap immediately.
 *
 * Idempotent: once unpublished the row no longer matches (status changed +
 * expires_at nulled). Never throws so the worker stays up.
 *
 * NOTE: this does NOT touch the scheduled-PUBLISH path — expiry only acts on
 * rows already `published`. Scheduled/draft rows are ignored.
 */
export async function processContentExpiry(
  job: Job,
  redis: Redis,
): Promise<{ pages: number; posts: number }> {
  const now = new Date();
  const touchedSites = new Set<string>();

  const expiredPages = await db
    .update(pages)
    .set({ status: "draft", workflowState: "draft", expiresAt: null, updatedAt: now })
    .where(
      and(
        eq(pages.status, "published"),
        isNotNull(pages.expiresAt),
        lte(pages.expiresAt, now),
        isNull(pages.deletedAt),
      ),
    )
    .returning({ id: pages.id, siteId: pages.siteId, slug: pages.slug });

  const expiredPosts = await db
    .update(posts)
    .set({ status: "draft", workflowState: "draft", expiresAt: null, updatedAt: now })
    .where(
      and(
        eq(posts.status, "published"),
        isNotNull(posts.expiresAt),
        lte(posts.expiresAt, now),
        isNull(posts.deletedAt),
      ),
    )
    .returning({ id: posts.id, siteId: posts.siteId, slug: posts.slug });

  for (const row of [...expiredPages, ...expiredPosts]) touchedSites.add(row.siteId);

  // Purge the renderer cache for every affected site so the now-unpublished
  // content vanishes from the public site + sitemap on the next request.
  for (const siteId of touchedSites) {
    try {
      await purgeSiteRenderCache(siteId, redis);
    } catch (err) {
      console.error(`[worker:content-expiry] cache purge for ${siteId} failed`, (err as Error).message);
    }
  }

  if (expiredPages.length > 0 || expiredPosts.length > 0) {
    console.log(
      `[worker:content-expiry] unpublished ${expiredPages.length} page(s) + ${expiredPosts.length} post(s) across ${touchedSites.size} site(s) (job #${job.id})`,
    );
  }
  return { pages: expiredPages.length, posts: expiredPosts.length };
}

/**
 * Sweep the public render + sitemap cache keys for a site (mirrors cache-purge).
 * Shared with the scheduled-publish sweep (the symmetric inverse of this job).
 */
export async function purgeSiteRenderCache(siteId: string, redis: Redis): Promise<void> {
  await redis.del(`render:${siteId}:site`);
  await redis.del(`render:${siteId}:nav`);
  await redis.del(`sitemap:${siteId}`);
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `render:${siteId}:*`, "COUNT", 200);
    cursor = next;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== "0");
}
