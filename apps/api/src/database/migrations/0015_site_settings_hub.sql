-- Site Settings hub (backlog #32 integrations + #31 CDN cache).
--
-- Adds two nullable jsonb columns to site_settings:
--   integrations — per-site third-party integrations (GA4, GTM, live-chat,
--                  raw head/body scripts). Published values are exposed on
--                  /api/v1/public/site and injected by the renderer.
--   cdn          — edge cache config (default TTL + path rules). MVP stores
--                  the config and drives the manual "Purge cache" action.
--
-- Both IF NOT EXISTS so re-applying is a no-op.

ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "integrations" jsonb;--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "cdn" jsonb;
