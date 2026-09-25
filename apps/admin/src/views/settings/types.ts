/** Site Settings hub (#32 integrations + #31 CDN). Shapes mirror the API DTOs. */

export interface SiteIntegrations {
  ga4MeasurementId?: string;
  gtmId?: string;
  liveChatId?: string;
  headScripts?: string;
  bodyScripts?: string;
}

export interface CdnRule {
  pattern: string;
  ttl: number;
}

export interface CdnConfig {
  defaultTtlSeconds?: number;
  rules?: CdnRule[];
}

/** i18n (B13): the site's locale set. */
export interface SiteLocales {
  defaultLocale: string;
  locales: string[];
}

/** Privacy & Consent — the consent-banner config (mirrors the API DTO). */
export interface ConsentConfig {
  enabled?: boolean;
  mode?: "all" | "eu";
  position?: "bottom" | "top" | "bottom-left" | "bottom-right";
  policyVersion?: string;
  policyUrl?: string;
  title?: string;
  message?: string;
  analyticsDescription?: string;
  marketingDescription?: string;
  accentColor?: string;
}

/** Privacy & Consent — the data-retention windows (mirrors the API DTO). */
export interface RetentionConfig {
  rawEventRetentionDays?: number;
  piiRetentionDays?: number;
}

export type CachePurgeScope = "all" | "path";

export interface CachePurgePayload {
  scope?: CachePurgeScope;
  path?: string;
}

export interface CachePurgeResult {
  enqueued: boolean;
  scope: string;
  path?: string;
}
