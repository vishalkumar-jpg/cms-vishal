-- PRIVACY & CONSENT — the compliance capstone that makes the Phase 2–5 tracking
-- layer legally shippable (GDPR/ePrivacy). Adds:
--   1. site_settings.consent + site_settings.retention (jsonb config) — drive the
--      renderer's consent banner/gating and the worker's retention-purge job.
--   2. consent_records — the append-only proof-of-consent ledger.
-- Every statement is IF NOT EXISTS / duplicate-safe (re-applying is a no-op).

-- 1. site_settings: consent + retention config (additive, nullable → no regression).
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "consent" jsonb;
--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "retention" jsonb;
--> statement-breakpoint

-- 2. consent_records — proof-of-consent ledger (append-only). IP is stored as a
--    SHA-256 hash only; visitorId is the random first-party id (may be null).
CREATE TABLE IF NOT EXISTS "ob_cms"."consent_records" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "ts" timestamp with time zone DEFAULT now() NOT NULL,
  "visitor_id" varchar(60),
  "analytics" boolean DEFAULT false NOT NULL,
  "marketing" boolean DEFAULT false NOT NULL,
  "policy_version" varchar(40),
  "method" varchar(20) DEFAULT 'custom' NOT NULL,
  "ip_hash" varchar(64),
  "meta" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."consent_records"
    ADD CONSTRAINT "consent_records_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cnr_site_ts_idx" ON "ob_cms"."consent_records" USING btree ("site_id","ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cnr_site_visitor_idx" ON "ob_cms"."consent_records" USING btree ("site_id","visitor_id");
