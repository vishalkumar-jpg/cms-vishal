-- PAGESPEED (Phase 1) — capture Lighthouse recommendations + group bulk scans.
--
-- Additive columns on the existing `page_audits` table (no new tables): the
-- worker already runs real Lighthouse; it now also persists the actionable
-- findings, and a `batch_id` groups every row from one "scan all pages" run so
-- progress is a simple aggregate. All statements are duplicate-safe.

ALTER TABLE "ob_cms"."page_audits" ADD COLUMN IF NOT EXISTS "recommendations" jsonb;
--> statement-breakpoint
ALTER TABLE "ob_cms"."page_audits" ADD COLUMN IF NOT EXISTS "batch_id" varchar(50);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pau_site_batch_idx" ON "ob_cms"."page_audits" USING btree ("site_id","batch_id");
