/**
 * Queue/job name mirror — MUST match apps/api/src/modules/queue/queue.constants.ts
 * (kept in sync manually until a shared queue package lands).
 */
export const QUEUE_NAMES = {
  SAMPLE: "sample",
  MEDIA_PROCESS: "media-process",
  SITEMAP_REBUILD: "sitemap-rebuild",
  CACHE_PURGE: "cache-purge",
  CRM_DELIVERY: "crm-delivery",
  CRM_DELIVERY_DLQ: "crm-delivery-dlq",
  AI_GENERATE: "ai-generate",
  WEBHOOK_DELIVERY: "webhook-delivery",
  WEBHOOK_DELIVERY_DLQ: "webhook-delivery-dlq",
  BACKUP: "backup",
  PAGE_AUDIT: "page-audit",
  ANALYTICS_ROLLUP: "analytics-rollup",
  PROFILE_REBUILD: "profile-rebuild",
  AUDIENCE_RECOMPUTE: "audience-recompute",
  WORKFLOW_RUN: "workflow-run",
  /** Privacy & Consent: daily retention purge of old analytics_events + stale PII. */
  RETENTION_PURGE: "retention-purge",
  /** CONTENT-OPS: per-minute scheduled unpublish / content expiry. */
  CONTENT_EXPIRY: "content-expiry",
  /** CONTENT-OPS: per-minute sweep publishing scheduled pages/posts whose time has come. */
  SCHEDULED_PUBLISH: "scheduled-publish",
  /** SITE-HEALTH: crawl a site's published pages + probe links for broken ones. */
  LINK_CHECK: "link-check",
  /** SITE-HEALTH: TLS handshake to verified custom domains → cert expiry (daily). */
  SSL_CHECK: "ssl-check",
  /** PAGESPEED: hourly sweep that fans scheduled "scan all pages" runs onto PAGE_AUDIT. */
  PAGE_AUDIT_SCHEDULE: "page-audit-schedule",
} as const;

/** Job names on the LINK_CHECK queue (mirror queue.constants.ts LINK_CHECK_JOBS). */
export const LINK_CHECK_JOBS = {
  RUN: "run",
} as const;

/** Job names on the SSL_CHECK queue (mirror queue.constants.ts SSL_CHECK_JOBS). */
export const SSL_CHECK_JOBS = {
  RUN: "run",
  SWEEP: "sweep",
} as const;

/** Job names on the CONTENT_EXPIRY queue (mirror queue.constants.ts CONTENT_EXPIRY_JOBS). */
export const CONTENT_EXPIRY_JOBS = {
  SWEEP: "sweep",
} as const;

/** Job names on the SCHEDULED_PUBLISH queue (mirror queue.constants.ts SCHEDULED_PUBLISH_JOBS). */
export const SCHEDULED_PUBLISH_JOBS = {
  SWEEP: "sweep",
} as const;

/** Job names on the RETENTION_PURGE queue (mirror queue.constants.ts RETENTION_JOBS). */
export const RETENTION_JOBS = {
  PURGE: "purge",
} as const;

/** Job names on the WORKFLOW_RUN queue (mirror queue.constants.ts WORKFLOW_JOBS). */
export const WORKFLOW_JOBS = {
  EXECUTE: "execute",
} as const;

/** Job names on the WEBHOOK_DELIVERY queue (mirror queue.constants.ts WEBHOOK_JOBS). */
export const WEBHOOK_JOBS = {
  DELIVER: "deliver",
} as const;

/** Job names on the BACKUP queue (mirror queue.constants.ts BACKUP_JOBS). */
export const BACKUP_JOBS = {
  RUN: "run",
  RESTORE: "restore",
  SCHEDULED: "scheduled",
} as const;

/** Job names on the PAGE_AUDIT queue (mirror queue.constants.ts PAGE_AUDIT_JOBS). */
export const PAGE_AUDIT_JOBS = {
  RUN: "run",
} as const;

/** Job names on the PAGE_AUDIT_SCHEDULE queue (worker-only; no API producer). */
export const PAGE_AUDIT_SCHEDULE_JOBS = {
  SWEEP: "sweep",
} as const;

/** Job names on the ANALYTICS_ROLLUP queue (mirror queue.constants.ts ANALYTICS_JOBS). */
export const ANALYTICS_JOBS = {
  ROLLUP: "rollup",
} as const;

export { BULL_PREFIX } from "@ob-cms/shared";
