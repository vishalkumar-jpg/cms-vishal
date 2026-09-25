import { boolean, jsonb, varchar } from "drizzle-orm/pg-core";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";

/**
 * `siteSettings` (prefix `sst`) — 1:1 with a site (unique `siteId`). Branding,
 * contact, social, analytics IDs. Created with defaults in the same transaction
 * as the site (see SitesService.create).
 */
export const siteSettings = obCmsSchema.table("site_settings", {
  ...baseColumns("sst"),
  siteId: varchar({ length: 50 })
    .notNull()
    .unique()
    .references(() => sites.id, { onDelete: "cascade" }),

  // i18n / localization (B13). ADDITIVE — defaults keep existing sites
  // single-locale and unaffected. `defaultLocale` is the canonical locale
  // served WITHOUT a URL prefix; `locales` is the full set the site publishes
  // translations for (always includes defaultLocale). BCP-47-ish short codes
  // (e.g. "en", "es", "fr", "pt-br") — validated in the DTO.
  defaultLocale: varchar({ length: 12 }).notNull().default("en"),
  locales: jsonb().$type<string[]>().notNull().default(["en"]),

  // Branding
  tagline: varchar({ length: 300 }),
  logoUrl: varchar({ length: 500 }),
  faviconUrl: varchar({ length: 500 }),
  primaryColor: varchar({ length: 9 }).default("#0066FF"),
  accentColor: varchar({ length: 9 }).default("#FF6600"),
  headingFont: varchar({ length: 120 }).default("Inter"),
  bodyFont: varchar({ length: 120 }).default("Inter"),
  defaultOgImageUrl: varchar({ length: 500 }),

  // Contact
  contactEmail: varchar({ length: 320 }),
  contactPhone: varchar({ length: 50 }),
  contactAddress: varchar({ length: 500 }),

  // Social
  socialLinkedin: varchar({ length: 500 }),
  socialTwitter: varchar({ length: 500 }),
  socialFacebook: varchar({ length: 500 }),
  socialInstagram: varchar({ length: 500 }),

  // Analytics / integrations
  ga4TrackingId: varchar({ length: 50 }),
  tawkToId: varchar({ length: 100 }),
  formsApiUrl: varchar({ length: 500 }),

  // Forms → CRM delivery (WAVE3b). Secret is write-only over the API
  // (site_admin+). When unset the pipeline falls back to the global
  // CRM_WEBHOOK_URL / CRM_HMAC_SECRET env. `crmDualWrite` + `crmLegacyUrl`
  // drive the HubSpot dual-write during cutover (FORM-19).
  crmWebhookUrl: varchar({ length: 1000 }),
  crmHmacSecret: varchar({ length: 200 }),
  crmDualWrite: boolean().notNull().default(false),
  crmLegacyUrl: varchar({ length: 1000 }),

  // Global chrome (GLOBAL-CHROME) — ONE header + ONE footer SerializedLayout per
  // site, applied by the renderer around EVERY page. Nullable: when unset the
  // renderer injects nothing (per-page nav/footer blocks remain unaffected).
  // MVP: save = live (no separate draft/publish for chrome).
  headerLayout: jsonb().$type<SerializedLayout>(),
  footerLayout: jsonb().$type<SerializedLayout>(),

  // Site Settings hub (backlog #32 / #31).
  //
  // `integrations` — per-site third-party integrations. Published values are
  // exposed verbatim on `/api/v1/public/site` and injected by the renderer into the
  // document head/body. `headScripts`/`bodyScripts` are admin-authored raw HTML
  // (trusted, but length-capped + sanity-validated in the DTO). The legacy
  // `ga4TrackingId` / `tawkToId` columns above remain the source for back-compat;
  // the hub mirrors them into `integrations.ga4MeasurementId` / `liveChatId`.
  integrations: jsonb().$type<SiteIntegrations>(),

  // `cdn` — edge cache configuration. MVP stores the config + drives the manual
  // "Purge cache" action; full edge enforcement (per-rule TTL at the CDN) is
  // future work. Renderer/origin enforcement is not wired off this yet.
  cdn: jsonb().$type<SiteCdnConfig>(),

  // PRIVACY & CONSENT — the compliance layer that makes the Phase 2–5 tracking
  // legally shippable (GDPR/ePrivacy). `consent` drives the renderer's consent
  // banner/preference-center + GATES every tracker; published verbatim on
  // `/api/v1/public/site`. `retention` drives the worker's daily retention-purge
  // job (analytics_events TTL + stale-PII anonymization). Both nullable —
  // unset ⇒ banner off + default retention windows.
  consent: jsonb().$type<SiteConsentConfig>(),
  retention: jsonb().$type<SiteRetentionConfig>(),

  // PAGESPEED (Phase 5) — per-site scheduled audits + performance-alert
  // thresholds. Nullable/additive: unset ⇒ no scheduled scans and no alerts
  // (Phases 1–4 behaviour unchanged). The worker's hourly `page-audit-schedule`
  // sweep reads `schedule` here and reuses the existing page-audit queue; the
  // Monitoring dashboard reads `alerts` to flag threshold breaches. No new table.
  pageAuditConfig: jsonb().$type<PageAuditConfig>(),
});

/**
 * Per-site PageSpeed automation config (Phase 5). Stored as a single additive
 * jsonb column on `site_settings` — schedule + alert thresholds only, no
 * duplicated audit data.
 */
export interface PageAuditConfig {
  /** Automatic recurring "scan all pages" (reuses the existing page-audit queue). */
  schedule?: {
    /** Master switch — false/unset ⇒ no scheduled scans. */
    enabled: boolean;
    /** Cadence. Weekly runs on `dayOfWeek`; daily every day. */
    frequency: "daily" | "weekly";
    /** UTC hour (0–23) the sweep fires the scan at. Default 3. */
    hour?: number;
    /** 0=Sun … 6=Sat for weekly cadence. Default 1 (Mon). */
    dayOfWeek?: number;
    /** Stamped by the worker sweep after enqueuing a scan (dedupe / "last run"). */
    lastScheduledScanAt?: string;
  };
  /** Score/vitals thresholds — a new scan below any of these raises a dashboard alert. */
  alerts?: {
    /** Master switch — false/unset ⇒ no alerting. */
    enabled: boolean;
    /** Minimum acceptable category scores (0–100). Below ⇒ alert. */
    performance?: number;
    accessibility?: number;
    seo?: number;
    bestPractices?: number;
    /** Maximum acceptable LCP (ms) / CLS (unitless). Above ⇒ alert. */
    lcpMs?: number;
    cls?: number;
  };
}

/** Per-site third-party integrations (Site Settings hub). All fields optional. */
export interface SiteIntegrations {
  /** Google Analytics 4 measurement id, e.g. `G-XXXXXXXXXX`. */
  ga4MeasurementId?: string;
  /** Google Tag Manager container id, e.g. `GTM-XXXXXXX`. */
  gtmId?: string;
  /** Live-chat widget id (Tawk.to property/widget or equivalent). */
  liveChatId?: string;
  /** Raw admin-authored HTML injected into <head> on every page. */
  headScripts?: string;
  /** Raw admin-authored HTML injected at end-of-<body> on every page. */
  bodyScripts?: string;
}

/**
 * Per-site Consent Management config (Privacy & Consent suite). Published on
 * `/api/v1/public/site` and read by the renderer's <ConsentManager/> to render the
 * banner + preference-center and GATE the trackers. All fields optional; when
 * `enabled` is false (or the block is unset) the renderer shows NO banner and
 * the trackers keep firing exactly as before (back-compat).
 */
export interface SiteConsentConfig {
  /** Master switch — false ⇒ no banner AND no gating (legacy behaviour). */
  enabled?: boolean;
  /**
   * Where the banner shows. `all` = every visitor (safest default). `eu` =
   * EU-only — an IP-geo SEAM: the renderer defaults to showing everywhere and
   * documents where an edge/geo header would narrow it (no IP-geo lookup here).
   */
  mode?: "all" | "eu";
  /** Banner corner. */
  position?: "bottom" | "top" | "bottom-left" | "bottom-right";
  /** Policy version — bumping it re-prompts everyone (stored in the cookie). */
  policyVersion?: string;
  /** Link to the site's privacy-policy page (rendered in the banner). */
  policyUrl?: string;
  /** Banner heading + body copy. */
  title?: string;
  message?: string;
  /** Per-category human descriptions shown in the preference-center. */
  analyticsDescription?: string;
  marketingDescription?: string;
  /** Accent colour for the primary buttons (falls back to the theme). */
  accentColor?: string;
}

/**
 * Per-site data-retention config (Privacy & Consent suite). Drives the daily
 * worker retention-purge job. Unset ⇒ the worker's env/defaults apply.
 */
export interface SiteRetentionConfig {
  /** Purge `analytics_events` older than this many days (default 400). */
  rawEventRetentionDays?: number;
  /**
   * Anonymize/erase stale identity PII (identities/visitor_profiles) not seen
   * for this many days. 0/unset ⇒ never (PII retention off).
   */
  piiRetentionDays?: number;
}

/** A single CDN cache rule: a path glob/prefix and a TTL in seconds. */
export interface SiteCdnRule {
  pattern: string;
  ttl: number;
}

/** Per-site CDN cache configuration (Site Settings hub). */
export interface SiteCdnConfig {
  /** Default edge TTL in seconds when no rule matches. */
  defaultTtlSeconds?: number;
  /** Ordered path-specific overrides. */
  rules?: SiteCdnRule[];
}

export type SiteSettingsRow = typeof siteSettings.$inferSelect;
export type NewSiteSettingsRow = typeof siteSettings.$inferInsert;
