-- PAGESPEED — persist skip/fail reasons on page_audits.
-- Additive detail column so the Monitoring UI can show why an audit ended
-- skipped/failed without reading worker logs. Duplicate-safe.

ALTER TABLE "ob_cms"."page_audits" ADD COLUMN IF NOT EXISTS "detail" varchar(500);
