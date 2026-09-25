import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { loadEnv } from "./load-env";
import { BULL_PREFIX, QUEUE_NAMES } from "./queue-names";
import { processCrmDelivery, type CrmDeliveryJobData } from "./processors/crm-delivery.processor";
import { processCachePurge, type CachePurgeJobData } from "./processors/cache-purge.processor";
import { processCrmSweeper } from "./processors/crm-sweeper.processor";
import { processAiGenerate, type AiGenerateJobData } from "./processors/ai-generate.processor";
import { processImage, type ImageProcessJobData } from "./processors/image-process.processor";
import {
  processWebhookDelivery,
  type WebhookDeliveryJobData,
} from "./processors/webhook-delivery.processor";
import { processBackup } from "./processors/backup.processor";
import {
  processPageAudit,
  type PageAuditJobData,
} from "./processors/page-audit.processor";
import { processAnalyticsRollup } from "./processors/analytics-rollup.processor";
import { processRetentionPurge } from "./processors/retention-purge.processor";
import { processContentExpiry } from "./processors/content-expiry.processor";
import { processScheduledPublish } from "./processors/scheduled-publish.processor";
import {
  processSitemapRebuild,
  type SitemapRebuildJobData,
} from "./processors/sitemap-rebuild.processor";
import { processProfileRebuild } from "./processors/profile-rebuild.processor";
import { processAudienceRecompute } from "./processors/audience-recompute.processor";
import {
  processWorkflowRun,
  type WorkflowRunJobData,
} from "./processors/workflow-run.processor";
import { processLinkCheck, type LinkCheckJobData } from "./processors/link-check.processor";
import { processSslCheck, type SslCheckJobData } from "./processors/ssl-check.processor";
import { processPageAuditSchedule } from "./processors/page-audit-schedule.processor";
import { BACKUP_JOBS, ANALYTICS_JOBS, RETENTION_JOBS, CONTENT_EXPIRY_JOBS, SCHEDULED_PUBLISH_JOBS, SSL_CHECK_JOBS, PAGE_AUDIT_SCHEDULE_JOBS } from "./queue-names";
import { initKsuid } from "./db/ksuid";

/**
 * OB-CMS worker process (Bun runtime). Runs separately from the API: the API
 * produces jobs, this consumes them; both share one Redis + Postgres.
 *
 * WAVE3b processors:
 *   - crm-delivery   — HMAC-signed forms→CRM webhook with retry/backoff; on
 *                      exhaustion routes to crm-delivery-dlq + marks dead_lettered.
 *   - cache-purge    — clears the public render API's render:<siteId>:* keys.
 *   - crm-sweeper    — repeatable; re-enqueues stuck submissions (Redis-loss net).
 */
loadEnv();

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
};

const redis = new Redis({ ...connection, maxRetriesPerRequest: null });

// Producers the processors need (DLQ mirror + sweeper re-enqueue).
const dlq = new Queue(QUEUE_NAMES.CRM_DELIVERY_DLQ, { connection, prefix: BULL_PREFIX });
const crmQueue = new Queue(QUEUE_NAMES.CRM_DELIVERY, { connection, prefix: BULL_PREFIX });
const webhookDlq = new Queue(QUEUE_NAMES.WEBHOOK_DELIVERY_DLQ, { connection, prefix: BULL_PREFIX });
// E26 — backup queue producer (the scheduled job enqueues `run` jobs onto it,
// and we register the daily repeatable cron on it below).
const backupQueue = new Queue(QUEUE_NAMES.BACKUP, { connection, prefix: BULL_PREFIX });
// Phase 2a — analytics rollup queue producer (we register the hourly repeatable
// cron on it below; the API does not produce onto this queue).
const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS_ROLLUP, { connection, prefix: BULL_PREFIX });
// Privacy & Consent — retention-purge queue producer (we register the daily
// repeatable cron on it below; the API does not produce onto this queue).
const retentionQueue = new Queue(QUEUE_NAMES.RETENTION_PURGE, { connection, prefix: BULL_PREFIX });
// CONTENT-OPS — content-expiry queue producer (we register the per-minute
// repeatable cron on it below; the API does not produce onto this queue).
const contentExpiryQueue = new Queue(QUEUE_NAMES.CONTENT_EXPIRY, { connection, prefix: BULL_PREFIX });
// CONTENT-OPS — scheduled-publish queue producer (per-minute cron below; the
// API only stamps status='scheduled' + scheduled_at, this sweep publishes).
const scheduledPublishQueue = new Queue(QUEUE_NAMES.SCHEDULED_PUBLISH, {
  connection,
  prefix: BULL_PREFIX,
});
// Phase 5 — workflow producers. The executor re-enqueues itself onto WORKFLOW_RUN
// (for a `wait`), and the audience/profile trigger hooks enqueue runs onto it.
// The workflow `enqueue_webhook_event` action produces onto WEBHOOK_DELIVERY.
const workflowQueue = new Queue(QUEUE_NAMES.WORKFLOW_RUN, { connection, prefix: BULL_PREFIX });
const webhookQueue = new Queue(QUEUE_NAMES.WEBHOOK_DELIVERY, { connection, prefix: BULL_PREFIX });
// SITE-HEALTH — ssl-check queue producer (we register the daily repeatable
// sweep cron on it below; the API also produces on-demand jobs onto it).
const sslCheckQueue = new Queue(QUEUE_NAMES.SSL_CHECK, { connection, prefix: BULL_PREFIX });
// PAGESPEED (Phase 5) — page-audit producer (the schedule sweep fans scheduled
// scans onto the EXISTING PAGE_AUDIT queue) + the schedule sweep queue itself
// (we register the hourly repeatable cron on it below; no API producer).
const pageAuditQueue = new Queue(QUEUE_NAMES.PAGE_AUDIT, { connection, prefix: BULL_PREFIX });
const pageAuditScheduleQueue = new Queue(QUEUE_NAMES.PAGE_AUDIT_SCHEDULE, {
  connection,
  prefix: BULL_PREFIX,
});

// --- legacy sample queue (W0) -----------------------------------------------
const sampleWorker = new Worker(
  QUEUE_NAMES.SAMPLE,
  async (job: Job) => {
    console.log(`[worker] sample ${job.name} #${job.id}`);
    return { ok: true };
  },
  { connection, prefix: BULL_PREFIX },
);

// --- forms→CRM delivery (flagship) ------------------------------------------
const crmWorker = new Worker<CrmDeliveryJobData>(
  QUEUE_NAMES.CRM_DELIVERY,
  async (job) => processCrmDelivery(job, dlq),
  { connection, prefix: BULL_PREFIX, concurrency: 5 },
);

// --- renderer cache purge ----------------------------------------------------
const cacheWorker = new Worker<CachePurgeJobData>(
  QUEUE_NAMES.CACHE_PURGE,
  async (job) => processCachePurge(job, redis),
  { connection, prefix: BULL_PREFIX },
);

// --- AI copilot page generation (WAVE4a) ------------------------------------
// Generates pages create draft rows, which need a KSUID id default. Initialize
// the generator before the worker can process a job.
void initKsuid().catch((err) =>
  console.error(`[worker:ai-generate] ksuid init failed`, (err as Error).message),
);
const aiWorker = new Worker<AiGenerateJobData>(
  QUEUE_NAMES.AI_GENERATE,
  async (job) => processAiGenerate(job, redis),
  { connection, prefix: BULL_PREFIX, concurrency: 2 },
);

// --- image processing (media optimization, gap D23) -------------------------
// Derives responsive/next-gen variants + intrinsic dims for confirmed uploads,
// and applies server-side crops. Degrades gracefully when sharp/@aws-sdk are
// absent (marks the row ready, no derivatives) — see image-process.processor.ts.
const imageWorker = new Worker<ImageProcessJobData>(
  QUEUE_NAMES.MEDIA_PROCESS,
  async (job) => processImage(job),
  { connection, prefix: BULL_PREFIX, concurrency: 3 },
);

// --- outbound webhook delivery (E27) ----------------------------------------
// HMAC-signed POST to subscriber URLs with retry/backoff; on exhaustion routes
// to webhook-delivery-dlq + marks the delivery row dead_lettered. Mirrors CRM.
const webhookWorker = new Worker<WebhookDeliveryJobData>(
  QUEUE_NAMES.WEBHOOK_DELIVERY,
  async (job) => processWebhookDelivery(job, webhookDlq),
  { connection, prefix: BULL_PREFIX, concurrency: 5 },
);

// --- platform database backup / restore (E26) -------------------------------
// pg_dump → gzip → upload (run), psql replay (restore), and a daily repeatable
// `scheduled` job that inserts a kind:scheduled row + enqueues a run. Needs the
// pg_dump/psql binaries at runtime — when absent a job marks the row `failed`
// with a clear message (it does NOT crash the worker). See apps/api/BACKUPS.md.
const backupWorker = new Worker<{ backupId?: string }>(
  QUEUE_NAMES.BACKUP,
  async (job) => processBackup(job, backupQueue),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- page audits / certification (#30) --------------------------------------
// Runs a REAL Lighthouse audit against the site's resolved public URL and
// writes the 4 category scores (0..100) + LCP/CLS onto the page_audits row.
// Needs a headless Chromium (CHROME_PATH) + the lighthouse/chrome-launcher deps
// at runtime — when absent (or the run throws/times out) the row is marked
// `skipped` and the worker does NOT crash. See apps/api/PAGE-AUDITS-LIGHTHOUSE.md.
const pageAuditWorker = new Worker<PageAuditJobData>(
  QUEUE_NAMES.PAGE_AUDIT,
  async (job) => processPageAudit(job),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- PAGESPEED scheduled scans (Phase 5) ------------------------------------
// Hourly sweep: for every site whose page_audit_config schedule is DUE this
// hour, fan out published pages onto the PAGE_AUDIT queue above (reuses the
// on-demand pipeline). Guarded + deduped inside the processor.
const pageAuditScheduleWorker = new Worker(
  QUEUE_NAMES.PAGE_AUDIT_SCHEDULE,
  async (job) => processPageAuditSchedule(job, pageAuditQueue),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- analytics rollup (Phase 2a) --------------------------------------------
// Aggregates recent raw analytics_events into the analytics_daily rollup so the
// stats API is fast. Idempotent upsert per (site,day,path); inserts supply a
// KSUID id so it relies on initKsuid() above.
const analyticsWorker = new Worker(
  QUEUE_NAMES.ANALYTICS_ROLLUP,
  async (job) => processAnalyticsRollup(job),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- identity profile rebuild (Phase 3) -------------------------------------
// Aggregates recent analytics_events into visitor_profiles (idempotent upsert
// per visitor, preserving any linked identity) and applies the site's active
// scoring_rules → a score. Inserts supply a KSUID id (relies on initKsuid()).
const profileWorker = new Worker<{ siteId: string }>(
  QUEUE_NAMES.PROFILE_REBUILD,
  async (job) => processProfileRebuild(job, workflowQueue),
  { connection, prefix: BULL_PREFIX, concurrency: 2 },
);

// --- audience membership recompute (Phase 3) --------------------------------
// Evaluates audience definitions against visitor_profiles/identities and
// rewrites audience_memberships (delete-all-then-insert per audience).
const audienceWorker = new Worker<{ siteId: string; audienceId?: string }>(
  QUEUE_NAMES.AUDIENCE_RECOMPUTE,
  async (job) => processAudienceRecompute(job, workflowQueue),
  { connection, prefix: BULL_PREFIX, concurrency: 2 },
);

// --- workflow executor (Phase 5) --------------------------------------------
// Advances a workflow_run's actions step-by-step (adjust_score / add_to_audience
// / add_tag / send_webhook / enqueue_webhook_event / send_email), re-enqueuing
// itself (with a delay) for a `wait`. Idempotent per run; an action error marks
// the run `failed` with a log entry but never crashes the worker.
const workflowWorker = new Worker<WorkflowRunJobData>(
  QUEUE_NAMES.WORKFLOW_RUN,
  async (job) => processWorkflowRun(job, workflowQueue, webhookQueue),
  { connection, prefix: BULL_PREFIX, concurrency: 3 },
);

// --- retention purge (Privacy & Consent) ------------------------------------
// Daily job that enforces each site's data-retention policy: hard-deletes
// analytics_events older than the site's rawEventRetentionDays window and
// (opt-in) anonymizes stale identity PII. Idempotent; never crashes the worker.
const retentionWorker = new Worker(
  QUEUE_NAMES.RETENTION_PURGE,
  async (job) => processRetentionPurge(job),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- content expiry (CONTENT-OPS: scheduled unpublish) ----------------------
// Per-minute job that unpublishes PUBLISHED pages/posts whose expires_at has
// passed (status→draft) and purges the renderer + sitemap cache for the site.
// Idempotent; never crashes the worker.
const contentExpiryWorker = new Worker(
  QUEUE_NAMES.CONTENT_EXPIRY,
  async (job) => processContentExpiry(job, redis),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- sitemap rebuild (debounced by the API: jobId sitemap:<siteId> + 5s) -----
// The sitemap is built on-demand + Redis-cached; "rebuild" = drop the cached
// key so the next /sitemap.xml regenerates. This queue was enqueued on every
// publish since WAVE2b but never consumed — sitemaps stayed stale for the TTL.
const sitemapWorker = new Worker<SitemapRebuildJobData>(
  QUEUE_NAMES.SITEMAP_REBUILD,
  async (job) => processSitemapRebuild(job, redis),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- scheduled publish (CONTENT-OPS: the symmetric inverse of expiry) --------
// Per-minute job that publishes SCHEDULED pages/posts whose scheduled_at has
// passed: draft layout goes live, a page_versions snapshot is written (rollback
// parity with manual publish), the site's render+sitemap cache is purged and
// page.published/post.published webhooks are emitted. Idempotent; never crashes
// the worker.
const scheduledPublishWorker = new Worker(
  QUEUE_NAMES.SCHEDULED_PUBLISH,
  async (job) => processScheduledPublish(job, redis, webhookQueue),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- SITE-HEALTH: broken-link crawl (#site-health) --------------------------
// Crawls a site's published pages, extracts <a href> links and probes each
// unique target (HEAD/GET, capped + bounded concurrency, short timeout),
// recording non-2xx/3xx (and dns/timeout) onto broken_links. Every network call
// is guarded — a broken/unreachable link is RECORDED, never crashes the worker.
// Inserts broken_links rows with a KSUID id (relies on initKsuid() above).
const linkCheckWorker = new Worker<LinkCheckJobData>(
  QUEUE_NAMES.LINK_CHECK,
  async (job) => processLinkCheck(job),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// --- SITE-HEALTH: SSL / domain-expiry check ---------------------------------
// On-demand (one domain) or daily sweep (all verified domains): opens a TLS
// socket to <domain>:443, reads the peer cert `valid_to` and stores it as
// tls_expires_at. DNS/timeout/no-cert are recorded (tls_check_error) — guarded,
// never crashes the worker.
const sslCheckWorker = new Worker<SslCheckJobData>(
  QUEUE_NAMES.SSL_CHECK,
  async (job) => processSslCheck(job),
  { connection, prefix: BULL_PREFIX, concurrency: 1 },
);

// Register the daily repeatable SSL sweep. Idempotent by (name + pattern), so
// re-adding on every boot is a no-op. Override cadence with SSL_CHECK_CRON.
void sslCheckQueue
  .add(
    SSL_CHECK_JOBS.SWEEP,
    {},
    {
      repeat: { pattern: process.env.SSL_CHECK_CRON ?? "0 4 * * *" },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  )
  .then(() => console.log(`[worker:ssl-check] daily cert-expiry sweep registered`))
  .catch((err) =>
    console.error(`[worker:ssl-check] could not register cron`, (err as Error).message),
  );

// Register the hourly repeatable PageSpeed schedule sweep. Idempotent by
// (name + pattern), so re-adding on every boot is a no-op. Override cadence
// with PAGE_AUDIT_SCHEDULE_CRON (must fire at least hourly to honour `hour`).
void pageAuditScheduleQueue
  .add(
    PAGE_AUDIT_SCHEDULE_JOBS.SWEEP,
    {},
    {
      repeat: { pattern: process.env.PAGE_AUDIT_SCHEDULE_CRON ?? "0 * * * *" },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  )
  .then(() => console.log(`[worker:page-audit-schedule] hourly scan sweep registered`))
  .catch((err) =>
    console.error(`[worker:page-audit-schedule] could not register cron`, (err as Error).message),
  );

// Register the daily repeatable retention purge. Idempotent by (name + pattern),
// so re-adding on every boot is a no-op. Override cadence with RETENTION_PURGE_CRON.
void retentionQueue
  .add(
    RETENTION_JOBS.PURGE,
    {},
    {
      repeat: { pattern: process.env.RETENTION_PURGE_CRON ?? "0 3 * * *" },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  )
  .then(() => console.log(`[worker:retention-purge] daily retention purge registered`))
  .catch((err) =>
    console.error(`[worker:retention-purge] could not register cron`, (err as Error).message),
  );

// Register the per-minute repeatable content-expiry sweep. Idempotent by
// (name + pattern), so re-adding on every boot is a no-op. Override cadence with
// CONTENT_EXPIRY_CRON (default: every minute).
void contentExpiryQueue
  .add(
    CONTENT_EXPIRY_JOBS.SWEEP,
    {},
    {
      repeat: { pattern: process.env.CONTENT_EXPIRY_CRON ?? "* * * * *" },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  )
  .then(() => console.log(`[worker:content-expiry] per-minute expiry sweep registered`))
  .catch((err) =>
    console.error(`[worker:content-expiry] could not register cron`, (err as Error).message),
  );

// Register the per-minute repeatable scheduled-publish sweep. Idempotent by
// (name + pattern), so re-adding on every boot is a no-op. Override cadence
// with SCHEDULED_PUBLISH_CRON (default: every minute).
void scheduledPublishQueue
  .add(
    SCHEDULED_PUBLISH_JOBS.SWEEP,
    {},
    {
      repeat: { pattern: process.env.SCHEDULED_PUBLISH_CRON ?? "* * * * *" },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  )
  .then(() => console.log(`[worker:scheduled-publish] per-minute publish sweep registered`))
  .catch((err) =>
    console.error(`[worker:scheduled-publish] could not register cron`, (err as Error).message),
  );

// Register the hourly repeatable rollup. Idempotent by (name + pattern), so
// re-adding on every boot is a no-op. Override cadence with ANALYTICS_ROLLUP_CRON.
void analyticsQueue
  .add(
    ANALYTICS_JOBS.ROLLUP,
    {},
    {
      repeat: { pattern: process.env.ANALYTICS_ROLLUP_CRON ?? "0 * * * *" },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  )
  .then(() => console.log(`[worker:analytics-rollup] hourly rollup registered`))
  .catch((err) =>
    console.error(`[worker:analytics-rollup] could not register cron`, (err as Error).message),
  );

// Register the daily repeatable backup. BullMQ repeatable jobs ARE available
// (bullmq 5.x): a single `scheduled` job runs on a cron pattern and is
// idempotent by jobId, so re-registering on every boot is a no-op. Override the
// cadence with BACKUP_CRON (default: 02:00 every day).
void backupQueue
  .add(
    BACKUP_JOBS.SCHEDULED,
    {},
    {
      // No custom jobId: BullMQ derives a stable repeat-key from
      // (name + pattern), so re-adding on every boot is idempotent.
      repeat: { pattern: process.env.BACKUP_CRON ?? "0 2 * * *" },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  )
  .then(() => console.log(`[worker:backup] daily scheduled backup registered`))
  .catch((err) => console.error(`[worker:backup] could not register cron`, (err as Error).message));

// --- crm-sweeper: in-process interval (re-enqueue stuck submissions) ---------
// Runs in-process (not a BullMQ queue) so it never competes with delivery jobs.
const sweeperTimer = setInterval(() => {
  void processCrmSweeper(crmQueue).catch((err) =>
    console.error(`[worker:crm-sweeper] failed`, (err as Error).message),
  );
}, 60_000);

for (const [w, label] of [
  [sampleWorker, "sample"],
  [crmWorker, "crm-delivery"],
  [cacheWorker, "cache-purge"],
  [aiWorker, "ai-generate"],
  [imageWorker, "image-process"],
  [webhookWorker, "webhook-delivery"],
  [backupWorker, "backup"],
  [pageAuditWorker, "page-audit"],
  [analyticsWorker, "analytics-rollup"],
  [retentionWorker, "retention-purge"],
  [contentExpiryWorker, "content-expiry"],
  [scheduledPublishWorker, "scheduled-publish"],
  [sitemapWorker, "sitemap-rebuild"],
  [profileWorker, "profile-rebuild"],
  [audienceWorker, "audience-recompute"],
  [workflowWorker, "workflow-run"],
  [linkCheckWorker, "link-check"],
  [sslCheckWorker, "ssl-check"],
  [pageAuditScheduleWorker, "page-audit-schedule"],
] as const) {
  w.on("completed", (job) => console.log(`[worker:${label}] completed #${job.id}`));
  w.on("failed", (job, err) => console.error(`[worker:${label}] failed #${job?.id}`, err.message));
}

console.log(
  `🛠️  OB-CMS worker listening on queues: ${QUEUE_NAMES.SAMPLE}, ${QUEUE_NAMES.CRM_DELIVERY}, ` +
    `${QUEUE_NAMES.CACHE_PURGE}, ${QUEUE_NAMES.AI_GENERATE} (+ DLQ ${QUEUE_NAMES.CRM_DELIVERY_DLQ})`,
);

const shutdown = async (): Promise<void> => {
  clearInterval(sweeperTimer);
  await Promise.allSettled([
    sampleWorker.close(),
    crmWorker.close(),
    cacheWorker.close(),
    aiWorker.close(),
    imageWorker.close(),
    webhookWorker.close(),
    backupWorker.close(),
    pageAuditWorker.close(),
    analyticsWorker.close(),
    retentionWorker.close(),
    contentExpiryWorker.close(),
    profileWorker.close(),
    audienceWorker.close(),
    workflowWorker.close(),
    linkCheckWorker.close(),
    sslCheckWorker.close(),
    pageAuditScheduleWorker.close(),
    sslCheckQueue.close(),
    pageAuditQueue.close(),
    pageAuditScheduleQueue.close(),
    dlq.close(),
    crmQueue.close(),
    webhookDlq.close(),
    backupQueue.close(),
    analyticsQueue.close(),
    retentionQueue.close(),
    contentExpiryQueue.close(),
    workflowQueue.close(),
    webhookQueue.close(),
    redis.quit(),
  ]);
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
