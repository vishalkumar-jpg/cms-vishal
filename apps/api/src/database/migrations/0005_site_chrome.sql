-- GLOBAL-CHROME — global header & footer (ONE each per site).
--
-- Adds two nullable jsonb columns to site_settings holding a SerializedLayout
-- (the same block-schema shape the page builder produces). The renderer injects
-- header_layout at the TOP and footer_layout at the BOTTOM of every page; when a
-- column is NULL the renderer injects nothing (per-page nav/footer unaffected).
--
-- MVP: save = live (no separate draft/publish for chrome). Both IF NOT EXISTS so
-- re-applying is a no-op.

ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "header_layout" jsonb;--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "footer_layout" jsonb;
