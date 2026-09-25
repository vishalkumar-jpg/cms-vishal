import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Worker-local schema mirror — only the tables the processors touch
 * (form_submissions, forms, site_settings, mock_crm_receipts). The API owns the
 * canonical Drizzle schema + migrations (apps/api/src/database/schema); this is
 * a column-compatible subset so the standalone Bun worker can query without
 * importing NestJS code. Keep column names/types in sync with the API schema.
 */
const obCmsSchema = pgSchema("ob_cms");

export const forms = obCmsSchema.table("forms", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 200 }).notNull(),
  status: varchar({ length: 20 }).notNull(),
  fields: jsonb(),
  settings: jsonb(),
  crmMapping: jsonb(),
});

export const formSubmissions = obCmsSchema.table("form_submissions", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  formId: varchar({ length: 50 }).notNull(),
  data: jsonb(),
  meta: jsonb(),
  status: varchar({ length: 20 }).notNull(),
  deliveryAttempts: integer().notNull().default(0),
  lastError: varchar({ length: 1000 }),
  deliveredAt: timestamp({ withTimezone: true }),
  idempotencyKey: varchar({ length: 60 }),
  isSpam: boolean().notNull().default(false),
});

export const siteSettings = obCmsSchema.table("site_settings", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  crmWebhookUrl: varchar({ length: 1000 }),
  crmHmacSecret: varchar({ length: 200 }),
  crmDualWrite: boolean().notNull().default(false),
  crmLegacyUrl: varchar({ length: 1000 }),
  // PRIVACY & CONSENT — the retention purge job reads per-site windows here
  // (mirror of the API's site-settings.schema.ts `retention` jsonb).
  retention: jsonb().$type<{ rawEventRetentionDays?: number; piiRetentionDays?: number }>(),
  // PAGESPEED (Phase 5) — the `page-audit-schedule` sweep reads `schedule` here
  // (mirror of the API's site-settings.schema.ts `pageAuditConfig` jsonb).
  pageAuditConfig: jsonb().$type<PageAuditConfig>(),
});

/** Mirror of the API's `PageAuditConfig` — only what the schedule sweep reads. */
export interface PageAuditConfig {
  schedule?: {
    enabled: boolean;
    frequency: "daily" | "weekly";
    hour?: number;
    dayOfWeek?: number;
    lastScheduledScanAt?: string;
  };
  alerts?: {
    enabled: boolean;
    performance?: number;
    accessibility?: number;
    seo?: number;
    bestPractices?: number;
    lcpMs?: number;
    cls?: number;
  };
}

// --- WAVE4a (AI copilot) mirror ---------------------------------------------

export const aiProviderKeys = obCmsSchema.table("ai_provider_keys", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  provider: varchar({ length: 20 }).notNull(),
  label: varchar({ length: 120 }),
  encryptedKey: varchar({ length: 2000 }).notNull(),
  keyHint: varchar({ length: 40 }).notNull(),
  lastUsedAt: timestamp({ withTimezone: true }),
});

export const aiGenerationJobs = obCmsSchema.table("ai_generation_jobs", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  siteId: varchar({ length: 50 }).notNull(),
  prompt: varchar({ length: 8000 }).notNull(),
  provider: varchar({ length: 20 }).notNull(),
  model: varchar({ length: 80 }).notNull(),
  status: varchar({ length: 20 }).notNull(),
  targetPageId: varchar({ length: 50 }),
  resultLayout: jsonb(),
  tokensIn: integer().notNull().default(0),
  tokensOut: integer().notNull().default(0),
  costEstimateMicroUsd: integer().notNull().default(0),
  error: varchar({ length: 2000 }),
});

export const themes = obCmsSchema.table("themes", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  preset: varchar({ length: 60 }).notNull(),
  tokens: jsonb(),
  brand: jsonb(),
});

/**
 * Worker creates/updates page DRAFTS (draftLayout) AND — CONTENT-OPS — runs the
 * expiry job which unpublishes rows whose `expires_at` has passed. Only the
 * subset of columns the worker touches is mirrored here.
 */
export const pages = obCmsSchema.table("pages", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar({ length: 50 }),
  updatedBy: varchar({ length: 50 }),
  siteId: varchar({ length: 50 }).notNull(),
  title: varchar({ length: 300 }).notNull(),
  slug: varchar({ length: 200 }).notNull(),
  status: varchar({ length: 20 }).notNull(),
  workflowState: varchar({ length: 20 }),
  draftLayout: jsonb(),
  publishedLayout: jsonb(),
  seo: jsonb(),
  parentId: varchar({ length: 50 }),
  schemaVersion: varchar({ length: 20 }).notNull(),
  deletedAt: timestamp({ withTimezone: true }),
  // CONTENT-OPS — scheduled publish + scheduled unpublish / expiry.
  scheduledAt: timestamp({ withTimezone: true }),
  publishedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }),
});

/**
 * CONTENT-OPS mirror — the scheduled-publish job snapshots a version row on
 * every publish (same as the API's manual publish path), so rollback works
 * identically for scheduled publishes.
 */
export const pageVersions = obCmsSchema.table("page_versions", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar({ length: 50 }),
  siteId: varchar({ length: 50 }).notNull(),
  pageId: varchar({ length: 50 }).notNull(),
  snapshot: jsonb().notNull(),
  label: varchar({ length: 200 }),
  authorId: varchar({ length: 50 }),
});

/** CONTENT-OPS mirror — the expiry job unpublishes posts past `expires_at`. */
export const posts = obCmsSchema.table("posts", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar({ length: 50 }),
  updatedBy: varchar({ length: 50 }),
  siteId: varchar({ length: 50 }).notNull(),
  title: varchar({ length: 300 }).notNull(),
  slug: varchar({ length: 200 }).notNull(),
  status: varchar({ length: 20 }).notNull(),
  workflowState: varchar({ length: 20 }),
  layout: jsonb(),
  seo: jsonb(),
  // NOTE: the real posts table has NO schema_version column (unlike pages) —
  // do not re-add it here; a full select() would 42703 on it.
  deletedAt: timestamp({ withTimezone: true }),
  scheduledAt: timestamp({ withTimezone: true }),
  publishedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }),
});

// --- Media optimization (gap D23) mirror ------------------------------------

/** One generated variant stored in `media.variants` (kept in sync with the API). */
export interface MediaVariant {
  width: number;
  format: string;
  url: string;
  bytes: number;
  height?: number;
}

export const media = obCmsSchema.table("media", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  storageKey: varchar({ length: 500 }).notNull(),
  url: varchar({ length: 1000 }),
  type: varchar({ length: 100 }).notNull(),
  size: bigint({ mode: "number" }),
  width: integer(),
  height: integer(),
  variants: jsonb().$type<MediaVariant[]>().notNull().default([]),
  focalPoint: jsonb().$type<{ x: number; y: number }>(),
  cropRect: jsonb().$type<{ x: number; y: number; w: number; h: number }>(),
  status: varchar({ length: 20 }).notNull().default("pending"),
});

export type MediaRow = typeof media.$inferSelect;

// --- E27 (outbound webhooks) mirror -----------------------------------------

export const webhooks = obCmsSchema.table("webhooks", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  url: varchar({ length: 1000 }).notNull(),
  events: jsonb().$type<string[]>().notNull().default([]),
  secret: varchar({ length: 200 }).notNull(),
  active: boolean().notNull().default(true),
});

export const webhookDeliveries = obCmsSchema.table("webhook_deliveries", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  siteId: varchar({ length: 50 }).notNull(),
  webhookId: varchar({ length: 50 }).notNull(),
  event: varchar({ length: 80 }).notNull(),
  payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  status: varchar({ length: 20 }).notNull().default("pending"),
  statusCode: integer(),
  attempts: integer().notNull().default(0),
  lastError: varchar({ length: 1000 }),
  deliveredAt: timestamp({ withTimezone: true }),
  nextRetryAt: timestamp({ withTimezone: true }),
});

export type WebhookRow = typeof webhooks.$inferSelect;
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;

// --- E26 (platform database backups) mirror ---------------------------------

/** Platform-level backup ledger (cross-tenant; no site_id). */
export const backups = obCmsSchema.table("backups", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  createdBy: varchar({ length: 50 }),
  updatedBy: varchar({ length: 50 }),
  filename: varchar({ length: 300 }).notNull(),
  sizeBytes: bigint({ mode: "number" }),
  status: varchar({ length: 20 }).notNull().default("pending"),
  kind: varchar({ length: 20 }).notNull().default("manual"),
  storageKey: varchar({ length: 500 }),
  error: varchar({ length: 2000 }),
  startedAt: timestamp({ withTimezone: true }),
  completedAt: timestamp({ withTimezone: true }),
});

export type BackupRow = typeof backups.$inferSelect;

/** One actionable Lighthouse finding (kept in sync with the API schema). */
export interface PageAuditRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  score: number | null;
  displayValue?: string;
  savingsMs?: number;
  savingsBytes?: number;
  /** Number of affected elements (from the LHR audit `details.items`). */
  affectedCount?: number;
  /** A small sample of affected element identifiers (urls / selectors). */
  affectedSamples?: string[];
}

/**
 * `page_audits` (#30) — column-compatible subset mirroring the API schema. The
 * page-audit processor updates the row it is given by id with real Lighthouse
 * scores (0..100), LCP (ms), CLS (unitless), the normalized recommendations and
 * a status.
 */
export const pageAudits = obCmsSchema.table("page_audits", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  pageId: varchar({ length: 50 }),
  path: varchar({ length: 500 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("seam"),
  performanceScore: integer(),
  accessibilityScore: integer(),
  seoScore: integer(),
  bestPracticesScore: integer(),
  lcp: doublePrecision(),
  cls: doublePrecision(),
  recommendations: jsonb().$type<PageAuditRecommendation[]>(),
  batchId: varchar({ length: 50 }),
  /** Failure/skip reason written by the processor (null on completed audits). */
  detail: varchar({ length: 500 }),
  ranAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type PageAuditRow = typeof pageAudits.$inferSelect;

// --- SITE-HEALTH (broken-link checker + SSL/domain-expiry) mirror -----------

/**
 * `link_checks` (SITE-HEALTH) — one crawl RUN. The link-check processor updates
 * the row it is given by id with the crawl summary + a status.
 */
export const linkChecks = obCmsSchema.table("link_checks", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  siteId: varchar({ length: 50 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("running"),
  pagesCrawled: integer().notNull().default(0),
  linksChecked: integer().notNull().default(0),
  brokenCount: integer().notNull().default(0),
  detail: varchar({ length: 1000 }),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
});

/** `broken_links` (SITE-HEALTH) — the processor inserts one row per broken target. */
export const brokenLinks = obCmsSchema.table("broken_links", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  siteId: varchar({ length: 50 }).notNull(),
  runId: varchar({ length: 50 }).notNull(),
  sourcePath: varchar({ length: 1000 }).notNull(),
  targetUrl: varchar({ length: 2000 }).notNull(),
  kind: varchar({ length: 10 }).notNull().default("external"),
  status: varchar({ length: 20 }).notNull(),
  checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * `site_domains` (SITE-HEALTH) — column-compatible subset. The ssl-check
 * processor reads verified domains and writes the cert-expiry columns.
 */
export const siteDomains = obCmsSchema.table("site_domains", {
  id: varchar({ length: 50 }).primaryKey(),
  siteId: varchar({ length: 50 }).notNull(),
  domain: varchar({ length: 255 }).notNull(),
  verified: boolean().notNull().default(false),
  status: varchar({ length: 20 }).notNull().default("pending"),
  tlsStatus: varchar({ length: 20 }).notNull().default("none"),
  tlsExpiresAt: timestamp({ withTimezone: true }),
  tlsCheckedAt: timestamp({ withTimezone: true }),
  tlsCheckError: varchar({ length: 500 }),
});

// PAGESPEED (Phase 5) — minimal `sites` mirror so the schedule sweep can
// resolve each site's public audit URL (mirrors the API's resolveAuditUrl).
export const sites = obCmsSchema.table("sites", {
  id: varchar({ length: 50 }).primaryKey(),
  subdomain: varchar({ length: 120 }).notNull(),
  primaryDomain: varchar({ length: 255 }),
  customDomain: varchar({ length: 255 }),
});

export type LinkCheckRow = typeof linkChecks.$inferSelect;
export type BrokenLinkRow = typeof brokenLinks.$inferSelect;
export type SiteDomainRow = typeof siteDomains.$inferSelect;

// --- Analytics (Phase 2a) mirror --------------------------------------------

/**
 * `analytics_events` — raw first-party beacon stream (pageviews + web-vitals +
 * custom events). The rollup reads recent rows; NO PII is stored.
 */
export const analyticsEvents = obCmsSchema.table("analytics_events", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  ts: timestamp({ withTimezone: true }).notNull().defaultNow(),
  type: varchar({ length: 20 }).notNull(),
  path: varchar({ length: 1000 }).notNull().default("/"),
  referrer: varchar({ length: 1000 }),
  source: varchar({ length: 20 }).notNull().default("direct"),
  medium: varchar({ length: 120 }),
  campaign: varchar({ length: 200 }),
  visitorId: varchar({ length: 60 }).notNull(),
  sessionId: varchar({ length: 60 }).notNull(),
  deviceType: varchar({ length: 10 }).notNull().default("desktop"),
  metric: varchar({ length: 10 }),
  value: doublePrecision(),
  name: varchar({ length: 120 }),
  // Phase 4 A/B testing dimensions (exposure/conversion events).
  experimentId: varchar({ length: 50 }),
  variant: varchar({ length: 20 }),
});

/** `analytics_daily` — per-(site,day,path) rollup the worker upserts hourly. */
export const analyticsDaily = obCmsSchema.table("analytics_daily", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  day: varchar({ length: 10 }).notNull(),
  path: varchar({ length: 1000 }).notNull().default("/"),
  pageviews: integer().notNull().default(0),
  visitors: integer().notNull().default(0),
  sessions: integer().notNull().default(0),
  sessionSeconds: integer().notNull().default(0),
  bouncedSessions: integer().notNull().default(0),
  sources: jsonb().$type<Record<string, number>>().notNull().default({}),
  devices: jsonb().$type<Record<string, number>>().notNull().default({}),
});

export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect;
export type AnalyticsDailyRow = typeof analyticsDaily.$inferSelect;

// --- Identity & audiences (Phase 3) mirror ----------------------------------
// Column-compatible subset of apps/api/src/database/schema/{identity,audiences}
// so the worker's profile-rebuild + audience-recompute jobs can query/upsert.

export const companies = obCmsSchema.table("companies", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  domain: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }),
  industry: varchar({ length: 120 }),
  size: varchar({ length: 40 }),
});

export const identities = obCmsSchema.table("identities", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  primaryEmail: varchar({ length: 320 }).notNull(),
  name: varchar({ length: 255 }),
  companyId: varchar({ length: 50 }),
});

export const visitorProfiles = obCmsSchema.table("visitor_profiles", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  visitorId: varchar({ length: 60 }).notNull(),
  firstSeen: timestamp({ withTimezone: true }),
  lastSeen: timestamp({ withTimezone: true }),
  sessions: integer().notNull().default(0),
  pageviews: integer().notNull().default(0),
  lastSource: varchar({ length: 20 }),
  lastDevice: varchar({ length: 10 }),
  topPaths: jsonb().$type<Array<{ path: string; views: number }>>().notNull().default([]),
  identityId: varchar({ length: 50 }),
  score: integer().notNull().default(0),
});

export const scoringRules = obCmsSchema.table("scoring_rules", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 200 }).notNull(),
  condition: jsonb().$type<{ field: string; op: string; value?: string | number | boolean }>().notNull(),
  points: integer().notNull().default(0),
  active: varchar({ length: 5 }).notNull().default("true"),
});

export const audienceDefinitions = obCmsSchema.table("audience_definitions", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 200 }).notNull(),
  description: varchar({ length: 500 }),
  rules: jsonb().notNull(),
});

export const audienceMemberships = obCmsSchema.table("audience_memberships", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  audienceId: varchar({ length: 50 }).notNull(),
  visitorProfileId: varchar({ length: 50 }).notNull(),
  visitorId: varchar({ length: 60 }).notNull(),
  identityId: varchar({ length: 50 }),
});

// --- PHASE-5: attribution + workflows ---------------------------------------

export const attributionConversions = obCmsSchema.table("attribution_conversions", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  ts: timestamp({ withTimezone: true }).notNull().defaultNow(),
  visitorId: varchar({ length: 60 }).notNull(),
  identityId: varchar({ length: 50 }),
  type: varchar({ length: 40 }).notNull().default("conversion"),
  label: varchar({ length: 200 }),
  value: doublePrecision().notNull().default(0),
  landingPath: varchar({ length: 1000 }),
  meta: jsonb().$type<Record<string, unknown>>(),
});

export const workflows = obCmsSchema.table("workflows", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 200 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("paused"),
  trigger: jsonb().$type<{ type: string; config?: Record<string, unknown> }>().notNull(),
});

export const workflowActions = obCmsSchema.table("workflow_actions", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  workflowId: varchar({ length: 50 }).notNull(),
  order: integer().notNull().default(0),
  type: varchar({ length: 40 }).notNull(),
  config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
});

export const workflowRuns = obCmsSchema.table("workflow_runs", {
  id: varchar({ length: 50 }).primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
  siteId: varchar({ length: 50 }).notNull(),
  workflowId: varchar({ length: 50 }).notNull(),
  subjectType: varchar({ length: 20 }).notNull().default("visitor"),
  subjectId: varchar({ length: 60 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("pending"),
  stepIndex: integer().notNull().default(0),
  runAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp({ withTimezone: true }),
  finishedAt: timestamp({ withTimezone: true }),
  log: jsonb()
    .$type<Array<{ at: string; step: number; type: string; ok: boolean; detail?: string }>>()
    .notNull()
    .default([]),
});

export type VisitorProfileRow = typeof visitorProfiles.$inferSelect;
export type ScoringRuleRow = typeof scoringRules.$inferSelect;
export type AudienceDefinitionRow = typeof audienceDefinitions.$inferSelect;
export type WorkflowRow = typeof workflows.$inferSelect;
export type WorkflowActionRow = typeof workflowActions.$inferSelect;
export type WorkflowRunRow = typeof workflowRuns.$inferSelect;

export type FormSubmissionRow = typeof formSubmissions.$inferSelect;
export type FormRow = typeof forms.$inferSelect;
export type SiteSettingsRow = typeof siteSettings.$inferSelect;
export type AiProviderKeyRow = typeof aiProviderKeys.$inferSelect;
export type AiGenerationJobRow = typeof aiGenerationJobs.$inferSelect;
/** Mirrors the API schema's AiProvider union (ai_provider_keys.provider values). */
export type AiProvider = "claude" | "openai" | "gemini";
export type ThemeRow = typeof themes.$inferSelect;
export type PageRow = typeof pages.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
