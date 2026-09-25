import type { SerializedLayout, PageSeo } from "@ob-cms/block-schema";

/**
 * Shapes returned by the Wave 3b `/api/v1/public/*` endpoints. Defined here
 * (additive, renderer-local) against the documented contract; the orchestrator
 * reconciles against the API's real DTOs. Every endpoint wraps its payload in
 * the standard `{ data }` envelope (packages/shared response.ts).
 */

/** Theme tokens become CSS custom properties on the page wrapper. */
export interface ThemeTokens {
  /** Flat token map, e.g. { "color-primary": "#0b5", "font-sans": "Inter" }. */
  [token: string]: string | number | undefined;
}

export interface SiteTheme {
  tokens: ThemeTokens;
  brand?: {
    name?: string;
    logoUrl?: string;
    faviconUrl?: string;
    [k: string]: unknown;
  };
}

export interface SiteSettings {
  /** Optional global flags (e.g. analytics ids). Kept open. */
  [k: string]: unknown;
}

/**
 * Site Settings hub (#32) — published per-site integrations the renderer injects
 * into the document head/body. Every field optional; only present ones render.
 */
export interface SiteIntegrations {
  /** GA4 measurement id, e.g. `G-XXXXXXXXXX` → gtag.js loader. */
  ga4MeasurementId?: string;
  /** GTM container id, e.g. `GTM-XXXXXXX`. */
  gtmId?: string;
  /** Live-chat widget id (Tawk.to property/widget). */
  liveChatId?: string;
  /** Admin-authored raw HTML injected into <head>. */
  headScripts?: string;
  /** Admin-authored raw HTML injected at end-of-<body>. */
  bodyScripts?: string;
}

/**
 * PRIVACY & CONSENT — the published consent-banner config the renderer's
 * <ConsentManager/> reads to render the banner/preference-center and GATE the
 * trackers. `null`/absent ⇒ no banner and trackers fire as before (back-compat).
 */
export interface PublicConsentConfig {
  enabled: boolean;
  mode: "all" | "eu";
  position: "bottom" | "top" | "bottom-left" | "bottom-right";
  policyVersion: string;
  policyUrl?: string;
  title?: string;
  message?: string;
  analyticsDescription?: string;
  marketingDescription?: string;
  accentColor?: string;
}

/**
 * GLOBAL-CHROME — the site's ONE global header + footer (SerializedLayout or
 * null). The catch-all route renders these around EVERY page; null → nothing.
 */
export interface PublicChrome {
  header: SerializedLayout | null;
  footer: SerializedLayout | null;
}

/** `GET /api/v1/public/site` → data */
export interface PublicSite {
  siteId: string;
  name: string;
  theme: SiteTheme;
  settings: SiteSettings;
  /** Published per-site integrations (Site Settings hub #32). Optional. */
  integrations?: SiteIntegrations;
  /** Published consent-banner config (Privacy & Consent). Null when disabled. */
  consent?: PublicConsentConfig | null;
  /** Global header/footer layouts (GLOBAL-CHROME). Optional for back-compat. */
  chrome?: PublicChrome;
  /** i18n (B13): canonical locale served without a URL prefix. Defaults to "en". */
  defaultLocale?: string;
  /** i18n (B13): every locale the site publishes. Defaults to [defaultLocale]. */
  locales?: string[];
}

/** i18n (B13): one available translation of a logical page → hreflang alternate. */
export interface PublicPageAlternate {
  locale: string;
  /** Public path: default locale has no prefix; others are `/<locale>/<path>`. */
  path: string;
}

/** `GET /api/v1/public/page?path=&locale=` → data */
export interface PublicPage {
  layout: SerializedLayout;
  seo: PageSeo;
  schemaVersion: string;
  /** i18n: the locale actually served (may differ from requested on fallback). */
  locale?: string;
  /** i18n: the site's default locale. */
  defaultLocale?: string;
  /** i18n: available translations of this logical page (for hreflang). */
  alternates?: PublicPageAlternate[];
}

/** A taxonomy term attached to a post. */
export interface PublicPostTerm {
  kind: "category" | "tag";
  name: string;
  slug: string;
}

/** `GET /api/v1/public/posts` → data (index cards; no layout body). */
export interface PublicPostCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
}

/** `GET /api/v1/public/posts/:slug` → data (full post). */
export interface PublicPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  layout: SerializedLayout;
  seo: PageSeo;
  coverMediaId: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  terms: PublicPostTerm[];
}

/** A single navigation item (header/footer). Kept tolerant of API drift. */
export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
  [k: string]: unknown;
}

/** `GET /api/v1/public/navigation` → data */
export interface PublicNavigation {
  header: NavItem[];
  footer: NavItem[];
}

/** `GET /api/v1/public/redirect?path=` → data | null */
export interface PublicRedirect {
  toPath: string;
  statusCode: 301 | 302 | number;
}

/** The API `{ data }` envelope. */
export interface ApiEnvelope<T> {
  data: T;
}

/** A field definition on a dynamic collection. */
export interface PublicCollectionField {
  key: string;
  label: string;
  type: "text" | "richtext" | "number" | "boolean" | "image" | "date" | "reference";
  required?: boolean;
}

/** A published collection item (field data only — no per-item layout). */
export interface PublicCollectionItem {
  id: string;
  slug: string;
  data: Record<string, unknown>;
  publishedAt: string | null;
}

/** Collection metadata on list responses — no detailLayout (avoids large payloads). */
export interface PublicCollectionListMeta {
  slug: string;
  name: string;
  fields: PublicCollectionField[];
}

/** Collection metadata on single-item responses — includes shared detailLayout. */
export interface PublicCollectionSummary extends PublicCollectionListMeta {
  /** Shared detail layout; null → generic field renderer. */
  detailLayout: SerializedLayout | null;
}

/** `GET /api/v1/public/collections/:slug/items/:itemSlug` → data */
export interface PublicCollectionItemDetail {
  collection: PublicCollectionSummary;
  item: PublicCollectionItem;
}
