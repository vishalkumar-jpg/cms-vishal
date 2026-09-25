-- PAGESPEED (Phase 5) — per-site scheduled audits + performance-alert thresholds.
--
-- Single additive jsonb column on the existing `site_settings` table (no new
-- table): `page_audit_config` holds `{ schedule, alerts }`. The worker's hourly
-- `page-audit-schedule` sweep reads `schedule` and reuses the existing
-- page-audit queue; the Monitoring dashboard reads `alerts` to flag threshold
-- breaches. Duplicate-safe.

ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "page_audit_config" jsonb;
