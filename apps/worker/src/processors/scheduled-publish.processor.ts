import type { Job } from "bullmq";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "../db/db";
import { pages, pageVersions, posts, webhookDeliveries, webhooks } from "../db/schema";
import { generateKSUIDWithPrefixSync } from "../db/ksuid";
import { WEBHOOK_EVENT, type WebhookEvent } from "@ob-cms/shared";
import { WEBHOOK_JOBS } from "../queue-names";
import { purgeSiteRenderCache } from "./content-expiry.processor";

/**
 * CONTENT-OPS — scheduled publish (the symmetric inverse of content-expiry).
 *
 * Repeatable job (every minute) that finds SCHEDULED pages/posts whose
 * `scheduled_at` has passed and publishes them, mirroring the API's manual
 * publish path (`PagesService.publish` / `BlogService.publish`):
 *   - pages: publishedLayout ← draftLayout (already schema-validated at save
 *     time), status/workflow_state → "published", publishedAt stamped,
 *     scheduledAt → null, and a `page_versions` snapshot row so rollback works
 *     identically for scheduled publishes,
 *   - posts: status/workflow_state → "published", publishedAt stamped (posts
 *     have a single `layout` column — nothing to copy),
 *   - the renderer's Redis cache + sitemap key for each touched site is purged,
 *   - `page.published` / `post.published` webhooks are emitted through the
 *     durable E27 delivery pipeline (deliveries row + retrying delivery job).
 *
 * Divergences from manual publish, on purpose:
 *   - `expires_at` is NOT cleared — "publish at X, expire at Y" is a valid
 *     publish window an editor sets up front; manual publish clears expiry
 *     because the editor is present to re-set it.
 *   - rows sitting in the `in_review` workflow state are SKIPPED (left
 *     scheduled), mirroring the API's editorial gate: once approved/rejected
 *     they publish on the next sweep.
 *   - a scheduled page with NO layout at all is flipped back to draft (the API
 *     rejects such publishes with a 400; here there is nobody to tell, and
 *     leaving it would retry forever).
 *
 * Idempotent: once published (or reverted) the row no longer matches the due
 * query. Every side effect is guarded — the worker never crashes.
 */
export async function processScheduledPublish(
  job: Job,
  redis: Redis,
  webhookQueue: Queue,
): Promise<{ pages: number; posts: number; reverted: number; skipped: number }> {
  const now = new Date();
  const touchedSites = new Set<string>();
  let publishedPages = 0;
  let publishedPosts = 0;
  let reverted = 0;
  let skipped = 0;

  // --- pages ----------------------------------------------------------------
  // Explicit column list (not select()) so mirror drift on unrelated columns
  // can never 42703 this sweep.
  const duePages = await db
    .select({
      id: pages.id,
      siteId: pages.siteId,
      slug: pages.slug,
      title: pages.title,
      workflowState: pages.workflowState,
      draftLayout: pages.draftLayout,
      publishedLayout: pages.publishedLayout,
      seo: pages.seo,
      createdBy: pages.createdBy,
      updatedBy: pages.updatedBy,
    })
    .from(pages)
    .where(
      and(
        eq(pages.status, "scheduled"),
        isNotNull(pages.scheduledAt),
        lte(pages.scheduledAt, now),
        isNull(pages.deletedAt),
      ),
    );

  for (const page of duePages) {
    try {
      // B14 editorial gate: don't publish out from under a reviewer.
      if (page.workflowState === "in_review") {
        skipped++;
        continue;
      }
      const layout = page.draftLayout ?? page.publishedLayout;
      if (!layout) {
        // Nothing to publish — revert to draft so the sweep doesn't loop on it.
        await db
          .update(pages)
          .set({ status: "draft", workflowState: "draft", scheduledAt: null, updatedAt: now })
          .where(eq(pages.id, page.id));
        console.error(
          `[worker:scheduled-publish] page ${page.id} (${page.slug}) had no layout — reverted to draft`,
        );
        reverted++;
        continue;
      }

      const [row] = await db
        .update(pages)
        .set({
          publishedLayout: layout,
          status: "published",
          workflowState: "published",
          publishedAt: now,
          scheduledAt: null,
          updatedAt: now,
        })
        .where(and(eq(pages.id, page.id), eq(pages.status, "scheduled")))
        .returning({ id: pages.id, siteId: pages.siteId, slug: pages.slug, title: pages.title });
      if (!row) continue; // raced with a manual publish/unschedule — someone else won.

      // Rollback parity: snapshot exactly what the manual publish path snapshots.
      await db.insert(pageVersions).values({
        id: generateKSUIDWithPrefixSync("pvr"),
        siteId: page.siteId,
        pageId: page.id,
        snapshot: { layout, seo: page.seo },
        label: `Published ${now.toISOString()} (scheduled)`,
        authorId: page.updatedBy ?? page.createdBy,
        createdBy: page.updatedBy ?? page.createdBy,
      });

      touchedSites.add(row.siteId);
      publishedPages++;
      await emitPublishedWebhook(webhookQueue, row.siteId, WEBHOOK_EVENT.PAGE_PUBLISHED, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        publishedAt: now.toISOString(),
      });
    } catch (err) {
      console.error(
        `[worker:scheduled-publish] page ${page.id} failed`,
        (err as Error).message,
      );
    }
  }

  // --- posts ------------------------------------------------------------------
  const duePosts = await db
    .select({
      id: posts.id,
      siteId: posts.siteId,
      slug: posts.slug,
      title: posts.title,
      workflowState: posts.workflowState,
      layout: posts.layout,
    })
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        isNotNull(posts.scheduledAt),
        lte(posts.scheduledAt, now),
        isNull(posts.deletedAt),
      ),
    );

  for (const post of duePosts) {
    try {
      if (post.workflowState === "in_review") {
        skipped++;
        continue;
      }
      if (!post.layout) {
        await db
          .update(posts)
          .set({ status: "draft", workflowState: "draft", scheduledAt: null, updatedAt: now })
          .where(eq(posts.id, post.id));
        console.error(
          `[worker:scheduled-publish] post ${post.id} (${post.slug}) had no layout — reverted to draft`,
        );
        reverted++;
        continue;
      }

      const [row] = await db
        .update(posts)
        .set({
          status: "published",
          workflowState: "published",
          publishedAt: now,
          scheduledAt: null,
          updatedAt: now,
        })
        .where(and(eq(posts.id, post.id), eq(posts.status, "scheduled")))
        .returning({ id: posts.id, siteId: posts.siteId, slug: posts.slug, title: posts.title });
      if (!row) continue;

      touchedSites.add(row.siteId);
      publishedPosts++;
      await emitPublishedWebhook(webhookQueue, row.siteId, WEBHOOK_EVENT.POST_PUBLISHED, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        publishedAt: now.toISOString(),
      });
    } catch (err) {
      console.error(
        `[worker:scheduled-publish] post ${post.id} failed`,
        (err as Error).message,
      );
    }
  }

  // Purge the renderer + sitemap cache for every affected site so the newly
  // published content is live on the next request.
  for (const siteId of touchedSites) {
    try {
      await purgeSiteRenderCache(siteId, redis);
    } catch (err) {
      console.error(
        `[worker:scheduled-publish] cache purge for ${siteId} failed`,
        (err as Error).message,
      );
    }
  }

  if (publishedPages > 0 || publishedPosts > 0 || reverted > 0) {
    console.log(
      `[worker:scheduled-publish] published ${publishedPages} page(s) + ${publishedPosts} post(s), ` +
        `reverted ${reverted}, skipped ${skipped} (in review) across ${touchedSites.size} site(s) (job #${job.id})`,
    );
  }
  return { pages: publishedPages, posts: publishedPosts, reverted, skipped };
}

/**
 * Emit a publish event through the durable E27 webhook pipeline: one
 * `webhook_deliveries` row per matching ACTIVE subscription + a retrying
 * delivery job. Envelope matches the API's WebhooksEmitter exactly
 * ({event, siteId, occurredAt, data}). Best-effort — never throws into the
 * publish sweep.
 */
async function emitPublishedWebhook(
  webhookQueue: Queue,
  siteId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.siteId, siteId), eq(webhooks.active, true)));
    const matching = subs.filter((s) => (s.events ?? []).includes(event));
    for (const sub of matching) {
      const [row] = await db
        .insert(webhookDeliveries)
        .values({
          id: generateKSUIDWithPrefixSync("whd"),
          siteId,
          webhookId: sub.id,
          event,
          payload: { event, siteId, occurredAt: new Date().toISOString(), data },
          status: "pending",
        })
        .returning({ id: webhookDeliveries.id });
      if (row?.id) {
        await webhookQueue.add(
          WEBHOOK_JOBS.DELIVER,
          { deliveryId: row.id, siteId },
          { jobId: `webhook:${row.id}`, attempts: 5, backoff: { type: "exponential", delay: 5000 } },
        );
      }
    }
  } catch (err) {
    console.error(
      `[worker:scheduled-publish] webhook emit (${event}) failed`,
      (err as Error).message,
    );
  }
}
