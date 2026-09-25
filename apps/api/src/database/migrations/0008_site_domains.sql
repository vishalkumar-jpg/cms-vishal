-- CUSTOM-DOMAINS — verification + TLS provisioning columns on site_domains.
--
-- The site_domains table itself ships in 0000_wave1a_tenancy (custom-domain
-- binding). This migration adds the verification-method + TLS state needed to
-- prove ownership via a DNS TXT record and to track cert issuance.
--
-- IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so re-applying is a no-op and so a
-- DB that already has the base table is upgraded in place.

ALTER TABLE "ob_cms"."site_domains" ADD COLUMN IF NOT EXISTS "verification_method" varchar(20) DEFAULT 'dns-txt' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ob_cms"."site_domains" ADD COLUMN IF NOT EXISTS "tls_status" varchar(20) DEFAULT 'none' NOT NULL;
