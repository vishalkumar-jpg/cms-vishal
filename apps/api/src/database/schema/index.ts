/**
 * Schema barrel — re-exports every table so drizzle gets full relational
 * typing via `drizzle(pool, { schema })`. Add new `*.schema.ts` files here.
 *
 * W1 (tenancy/auth/RBAC spine):
 *   organizations → sites → site_settings / site_members / site_domains
 *   system_users (identity), password_reset_tokens, audit_log.
 */
export * from "./_schema";
export * from "./system-users.schema";
export * from "./organizations.schema";
export * from "./sites.schema";
export * from "./site-settings.schema";
export * from "./site-members.schema";
export * from "./custom-roles.schema";
export * from "./site-invitations.schema";
export * from "./site-domains.schema";
export * from "./audit-log.schema";
export * from "./password-reset-tokens.schema";
export * from "./refresh-tokens.schema";
export * from "./totp-backup-codes.schema";

// W2b (CMS authoring core): pages/blog/media/navigation/themes/redirects/templates.
export * from "./pages.schema";
export * from "./posts.schema";
export * from "./media.schema";
export * from "./navigation.schema";
export * from "./themes.schema";
export * from "./redirects.schema";
export * from "./page-templates.schema";
export * from "./reusable-blocks.schema";

// Phase 1 — platform template skeleton catalog (global, not site-scoped).
export * from "./template-skeletons.schema";

// WAVE3b (forms + forms→CRM reliability pipeline).
export * from "./forms.schema";
export * from "./mock-crm-receipts.schema";

// WAVE4a (AI copilot — BYOK page generation).
export * from "./ai.schema";

// WAVE5 (dynamic collections / custom content types).
export * from "./collections.schema";

// E27 (public read-only Content API keys + outbound webhooks).
export * from "./api-keys.schema";
export * from "./webhooks.schema";

// MONITORING (#29/#37/#30): runtime_errors + page_audits (CRM-sync reads form_submissions).
export * from "./monitoring.schema";

// SITE-HEALTH (broken-link checker): link_checks (a run) + broken_links (results).
export * from "./link-checks.schema";

// E26 (platform-level database backup / restore ledger).
export * from "./backups.schema";

// COLLAB (builder comments): threaded page-builder comments + pins.
export * from "./page-comments.schema";

// PHASE-2 — analytics pipeline (first-party pageviews/web-vitals + daily rollup).
export * from "./analytics.schema";

// PHASE-3 — identity & audiences (visitor profiles, identities, companies,
// scoring rules) + audience definitions/memberships.
export * from "./identity.schema";
export * from "./audiences.schema";

// PHASE-4 — A/B experiments (definitions + weighted variants). Exposures &
// conversions are recorded on `analytics_events` (experimentId/variant dims).
export * from "./experiments.schema";

// PHASE-5 — revenue & orchestration. Attribution conversions (touchpoints are
// derived on-read from analytics_events) + workflows/automation (trigger →
// ordered actions → runs, executed by the worker).
export * from "./attribution.schema";
export * from "./workflows.schema";

// PRIVACY & CONSENT — GDPR/ePrivacy compliance layer. `consent_records` is the
// proof-of-consent ledger; the consent + retention config live as jsonb on
// site_settings (see site-settings.schema.ts). DSAR erasure spans the analytics/
// identity/attribution/forms tables; the worker purges old analytics_events.
export * from "./consent.schema";

// CONTENT-OPS — soft concurrent-edit locks for the page/post builders. Advisory:
// warns a second editor and offers view-only / take-over; never blocks a save.
export * from "./content-locks.schema";

// NOTIFICATIONS — in-app header-bell notifications (comments / editorial workflow
// / mentions), one row per recipient, current-user-scoped read model.
export * from "./notifications.schema";

// CONNECTORS — encrypted per-site provider connections (HubSpot, Salesforce, …).
export * from "./connector-connections.schema";
export * from "./import-runs.schema";
export * from "./connector-asset-mappings.schema";
export * from "./connector-asset-mappings.schema";
export * from "./import-run-items.schema";
