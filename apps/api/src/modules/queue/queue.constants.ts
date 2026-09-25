/**
 * Centralized queue/job-name registry (mirrors the frontend QUERY_KEYS rule):
 * never use string literals for queue/job names — reference these enums.
 *
 * W2b adds the CMS content queues. Producers live in the API; the worker wave
 * implements the processors.
 */
export enum QUEUE_NAMES {
  SAMPLE = "sample",
  /** Image processing: derive dimensions + responsive variants for an upload. */
  MEDIA_PROCESS = "media-process",
  /** Debounced sitemap.xml regeneration after a publish. */
  SITEMAP_REBUILD = "sitemap-rebuild",
  /** Renderer cache invalidation after a publish/unpublish. */
  CACHE_PURGE = "cache-purge",
  /** Forms→CRM: HMAC-signed webhook delivery with retry/backoff (WAVE3b). */
  CRM_DELIVERY = "crm-delivery",
  /** Dead-letter for exhausted CRM deliveries — durable mirror of dead_lettered. */
  CRM_DELIVERY_DLQ = "crm-delivery-dlq",
  /** AI copilot: schema-grounded page generation via the tenant's BYOK key (WAVE4a). */
  AI_GENERATE = "ai-generate",
  /** Outbound webhook delivery: HMAC-signed POST with retry/backoff (E27). */
  WEBHOOK_DELIVERY = "webhook-delivery",
  /** Dead-letter for exhausted webhook deliveries — durable mirror of dead_lettered. */
  WEBHOOK_DELIVERY_DLQ = "webhook-delivery-dlq",
  /** Platform-level pg_dump backup + restore jobs (E26). */
  BACKUP = "backup",
  /** Page-audit: run a real Lighthouse audit for a page path (#30). */
  PAGE_AUDIT = "page-audit",
  /** Analytics: hourly rollup of raw events → analytics_daily (Phase 2a). */
  ANALYTICS_ROLLUP = "analytics-rollup",
  /** Phase 3: rebuild visitor_profiles from events + apply scoring rules. */
  PROFILE_REBUILD = "profile-rebuild",
  /** Phase 3: recompute audience_memberships from visitor_profiles. */
  AUDIENCE_RECOMPUTE = "audience-recompute",
  /** Phase 5: execute a workflow_run's actions step-by-step (respecting wait). */
  WORKFLOW_RUN = "workflow-run",
  /** Privacy & Consent: daily retention purge of old analytics_events + stale PII. */
  RETENTION_PURGE = "retention-purge",
  /** SITE-HEALTH: crawl a site's published pages + probe links for broken ones. */
  LINK_CHECK = "link-check",
  /** SITE-HEALTH: TLS handshake to verified custom domains → cert expiry (daily). */
  SSL_CHECK = "ssl-check",
}

export enum SAMPLE_JOBS {
  PING = "ping",
}

export enum MEDIA_JOBS {
  PROCESS = "process",
  /** Apply a server-side crop and re-derive variants. */
  CROP = "crop",
}

export enum SITEMAP_JOBS {
  REBUILD = "rebuild",
}

export enum CACHE_JOBS {
  PURGE = "purge",
}

export enum CRM_JOBS {
  DELIVER = "deliver",
}

export enum AI_JOBS {
  GENERATE = "generate",
}

export enum WEBHOOK_JOBS {
  DELIVER = "deliver",
}

export enum BACKUP_JOBS {
  /** Run a pg_dump → gzip → upload for a `backups` row. */
  RUN = "run",
  /** Restore a completed backup (download → pg_restore/psql). GUARDED. */
  RESTORE = "restore",
  /** Repeatable/cron: enqueue a `kind:scheduled` backup (daily). */
  SCHEDULED = "scheduled",
}

export enum PAGE_AUDIT_JOBS {
  /** Run a real Lighthouse audit against the resolved public URL. GUARDED. */
  RUN = "run",
}

export enum ANALYTICS_JOBS {
  /** Repeatable/cron (hourly): aggregate recent events into analytics_daily. */
  ROLLUP = "rollup",
}

export enum PROFILE_JOBS {
  /** Rebuild visitor_profiles for a site (recent visitors) + apply scoring. */
  REBUILD = "rebuild",
}

export enum AUDIENCE_JOBS {
  /** Recompute memberships for one audience (or all of a site). */
  RECOMPUTE = "recompute",
}

export enum WORKFLOW_JOBS {
  /** Execute (or resume) a workflow_run's actions step-by-step. */
  EXECUTE = "execute",
}

export enum RETENTION_JOBS {
  /** Repeatable/cron (daily): purge old analytics_events + anonymize stale PII. */
  PURGE = "purge",
}

export enum LINK_CHECK_JOBS {
  /** Crawl a site's published pages + probe links → record broken ones. GUARDED. */
  RUN = "run",
}

export enum SSL_CHECK_JOBS {
  /** Check one site's verified domains' cert expiry (on-demand). GUARDED. */
  RUN = "run",
  /** Repeatable/cron (daily): sweep ALL verified domains' cert expiry. */
  SWEEP = "sweep",
}

/** Payload enqueued for the media-process worker (worker fills variants/dims). */
export interface MediaProcessJob {
  siteId: string;
  mediaId: string;
  storageKey: string;
  /**
   * Optional server-side crop (pixels in the intrinsic image). When present the
   * worker crops the source first, then derives variants from the cropped image.
   */
  crop?: { x: number; y: number; w: number; h: number };
}

/** Payload for the debounced sitemap rebuild (per-site). */
export interface SitemapRebuildJob {
  siteId: string;
}

/** Payload for renderer cache purge after a publish. */
export interface CachePurgeJob {
  siteId: string;
  entity: "page" | "post" | "chrome" | "reusable-block" | "collection";
  entityId: string;
  slug: string;
}

/**
 * Payload for a forms→CRM delivery. The worker loads the submission by id
 * (Postgres is the source of truth), builds + HMAC-signs the payload and POSTs.
 * Only ids travel through Redis so the queue never holds lead PII.
 */
export interface CrmDeliveryJob {
  submissionId: string;
  siteId: string;
  formId: string;
}

/**
 * Payload for an AI page-generation job (WAVE4a). Only the job id + site travel
 * through Redis — the worker loads the `ai_generation_jobs` row (prompt,
 * provider, model, targetPageId) from Postgres (the source of truth) and
 * decrypts the tenant's BYOK key there, so no prompt content or secret is ever
 * held in the queue. `actorId` lets the worker stamp the draft page it creates.
 */
export interface AiGenerateJob {
  jobId: string;
  siteId: string;
  actorId: string;
}

/**
 * Payload for an outbound webhook delivery (E27). Only the delivery-row id +
 * site travel through Redis — the worker loads the `webhook_deliveries` row
 * (event, payload) and its parent `webhooks` row (url, secret) from Postgres
 * (the source of truth), HMAC-signs the payload and POSTs it, so no secret or
 * subscriber URL is ever held in the queue.
 */
export interface WebhookDeliveryJob {
  deliveryId: string;
  siteId: string;
}

/**
 * Payload for a backup RUN job (E26). Only the `backups` row id travels through
 * Redis — the worker reads `DATABASE_URL` from its own env, runs `pg_dump`,
 * gzips + uploads, then updates the row (Postgres is the source of truth).
 */
export interface BackupRunJob {
  backupId: string;
}

/**
 * Payload for a backup RESTORE job (E26). HEAVILY guarded: the API only
 * enqueues this after an explicit confirm flag. The worker downloads the dump
 * for `backupId` and replays it into the cluster — this OVERWRITES live data.
 */
export interface BackupRestoreJob {
  backupId: string;
}

/**
 * Payload for a page-audit RUN job (#30). Only ids + the pre-resolved public
 * URL travel through Redis — the API resolves the site's public URL for `path`
 * (primary/custom domain, else subdomain, else the local renderer with the
 * tenant Host) and enqueues it. The worker loads the `page_audits` row by
 * `auditId` (Postgres is the source of truth), runs Lighthouse against `url`
 * and writes the scores. GUARDED: without a headless-Chromium/Lighthouse the
 * worker marks the row `skipped` — it never crashes.
 */
export interface PageAuditJob {
  auditId: string;
  siteId: string;
  path: string;
  url: string;
  /** Tenant Host forwarded to the renderer (e.g. `acme.localhost` in dev). */
  hostHeader: string;
}

/**
 * Payload for a profile-rebuild job (Phase 3). Only the site id travels through
 * Redis — the worker aggregates recent `analytics_events` into `visitor_profiles`
 * (idempotent upsert per visitor) and applies the site's active `scoring_rules`
 * → a score. Postgres is the source of truth.
 */
export interface ProfileRebuildJob {
  siteId: string;
}

/**
 * Payload for an audience-recompute job (Phase 3). The worker evaluates the
 * audience definition(s) against `visitor_profiles`/`identities` and rewrites
 * `audience_memberships` (delete-all-then-insert per audience). Omit
 * `audienceId` to recompute every audience of the site.
 */
export interface AudienceRecomputeJob {
  siteId: string;
  audienceId?: string;
}

/**
 * Payload for a workflow-run execution job (Phase 5). Only ids travel through
 * Redis — the worker loads the `workflow_runs` row (+ its workflow's actions)
 * from Postgres (the source of truth) and advances it step-by-step, respecting
 * any `wait` action by re-enqueuing itself with a delay. Idempotent per run.
 */
export interface WorkflowRunJob {
  siteId: string;
  runId: string;
}

/**
 * Payload for a broken-link check RUN (SITE-HEALTH). Only ids + the pre-resolved
 * site base URL travel through Redis — the worker loads the `link_checks` row by
 * `runId` (Postgres is the source of truth), fetches each published page's HTML
 * from the renderer (host-resolved via `hostHeader`), extracts `<a href>` links,
 * probes each unique target and records the broken ones onto `broken_links`.
 * GUARDED: network errors are recorded (never crash).
 */
export interface LinkCheckJob {
  runId: string;
  siteId: string;
  /** The site's public base URL (origin) links are fetched/resolved against. */
  baseUrl: string;
  /** Host header carried so the renderer resolves the right tenant. */
  hostHeader: string;
}

/**
 * Payload for an SSL/cert-expiry check (SITE-HEALTH). Omit `domainId` for the
 * daily sweep (all verified domains across all sites); pass it for an on-demand
 * single-domain re-check. The worker performs a TLS handshake to <domain>:443,
 * reads the peer cert `valid_to` and stores it on the `site_domains` row.
 * GUARDED: DNS/timeout/no-cert are recorded, never crash.
 */
export interface SslCheckJob {
  siteId?: string;
  domainId?: string;
}
