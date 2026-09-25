/**
 * Admin query keys. The shared `QUERY_KEYS` enum (@ob-cms/shared) covers
 * auth/sites/members; these are the admin-only feature keys (Wave 2). Kept as a
 * const enum-like object so wrapped hooks reference stable keys.
 */
export const ADMIN_QUERY_KEYS = {
  PAGES: "pages",
  PAGE: "page",
  PAGE_VERSIONS: "page-versions",
  TEMPLATES: "templates",
  TEMPLATE_CATALOG: "template-catalog",
  TEMPLATE_SKELETON: "template-skeleton",
  MEDIA: "media",
  MEDIA_ITEM: "media-item",
  MEDIA_FOLDERS: "media-folders",
  MEDIA_USAGE: "media-usage",
  THEME: "theme",
  NAVIGATION: "navigation",
  REDIRECTS: "redirects",
  DOMAINS: "domains",
  INVITATIONS: "invitations",
  AUDIT: "audit",
  POSTS: "posts",
  POST: "post",
  POST_TERMS: "post-terms",
  FORMS: "forms",
  FORM: "form",
  FORM_SUBMISSIONS: "form-submissions",
  CRM_CONFIG: "crm-config",
  REUSABLE_BLOCKS: "reusable-blocks",
  REUSABLE_BLOCK: "reusable-block",
  COLLECTIONS: "collections",
  COLLECTION: "collection",
  COLLECTION_ITEMS: "collection-items",
  COLLECTION_ITEM: "collection-item",
  // Platform-admin console (cross-tenant).
  PLATFORM_OVERVIEW: "platform-overview",
  PLATFORM_SITES: "platform-sites",
  PLATFORM_USERS: "platform-users",
  PLATFORM_BACKUPS: "platform-backups",
  // Connectors — provider connections + import activity.
  CONNECTORS: "connectors",
  CONNECTOR_CONNECTIONS: "connector-connections",
  CONNECTOR_IMPORT_RUNS: "connector-import-runs",
  // E27 — Developers (Content API keys + webhooks).
  API_KEYS: "api-keys",
  WEBHOOKS: "webhooks",
  WEBHOOK_DELIVERIES: "webhook-deliveries",
  // Global content search (⌘K command palette).
  SEARCH: "search",
  // Site Settings hub (#32 integrations + #31 CDN).
  SETTINGS_INTEGRATIONS: "settings-integrations",
  SETTINGS_CDN: "settings-cdn",
  // Privacy & Consent (consent banner config + retention + DSAR + records).
  SETTINGS_CONSENT: "settings-consent",
  SETTINGS_RETENTION: "settings-retention",
  CONSENT_RECORDS: "consent-records",
  DSAR_SUBJECT: "dsar-subject",
  // i18n / localization (B13): the site's locale set + per-page translations.
  SETTINGS_LOCALES: "settings-locales",
  PAGE_TRANSLATIONS: "page-translations",
  POST_TRANSLATIONS: "post-translations",
  // Monitoring hub (#29/#37/#30).
  CRM_DELIVERIES: "crm-deliveries",
  RUNTIME_ERRORS: "runtime-errors",
  PAGE_AUDITS: "page-audits",
  // SITE-HEALTH — broken-link checker.
  BROKEN_LINKS: "broken-links",
  // COLLAB — builder page comments.
  PAGE_COMMENTS: "page-comments",
  // Phase 2b — Analytics dashboards (site-scoped stats API).
  ANALYTICS: "analytics",
  // Phase 3 — Identity & audiences (B2B intelligence).
  IDENTITY_VISITORS: "identity-visitors",
  IDENTITY_VISITOR: "identity-visitor",
  IDENTITY_IDENTITIES: "identity-identities",
  IDENTITY_COMPANIES: "identity-companies",
  IDENTITY_SCORING_RULES: "identity-scoring-rules",
  IDENTITY_RULE_FIELDS: "identity-rule-fields",
  AUDIENCES: "audiences",
  AUDIENCE: "audience",
  AUDIENCE_MEMBERS: "audience-members",
  // Phase 4 — A/B experiments.
  EXPERIMENTS: "experiments",
  EXPERIMENT: "experiment",
  EXPERIMENT_RESULTS: "experiment-results",
  // Phase 5 — Revenue & orchestration (attribution + workflows).
  ATTRIBUTION: "attribution",
  WORKFLOWS: "workflows",
  WORKFLOW: "workflow",
  WORKFLOW_RUNS: "workflow-runs",
  // NOTIFICATIONS — header-bell in-app notifications (current-user scoped).
  NOTIFICATIONS: "notifications",
} as const;

export type AdminQueryKey = (typeof ADMIN_QUERY_KEYS)[keyof typeof ADMIN_QUERY_KEYS];
