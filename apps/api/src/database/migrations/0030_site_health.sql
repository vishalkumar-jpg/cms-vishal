-- SITE-HEALTH — broken-link checker + SSL/domain-expiry monitoring.
--
-- Adds two tenant-scoped tables for the broken-link crawl (link_checks + a run's
-- broken_links) and extends site_domains with cert-expiry columns for the daily
-- SSL check. All statements are IF NOT EXISTS / duplicate-safe so re-applying is
-- a no-op.

-- 1. link_checks — one crawl RUN per site.
CREATE TABLE IF NOT EXISTS "ob_cms"."link_checks" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "pages_crawled" integer DEFAULT 0 NOT NULL,
  "links_checked" integer DEFAULT 0 NOT NULL,
  "broken_count" integer DEFAULT 0 NOT NULL,
  "detail" varchar(1000),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."link_checks"
    ADD CONSTRAINT "link_checks_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lkc_site_started_idx" ON "ob_cms"."link_checks" USING btree ("site_id","started_at");
--> statement-breakpoint

-- 2. broken_links — the non-2xx/3xx targets found by a run.
CREATE TABLE IF NOT EXISTS "ob_cms"."broken_links" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "run_id" varchar(50) NOT NULL,
  "source_path" varchar(1000) NOT NULL,
  "target_url" varchar(2000) NOT NULL,
  "kind" varchar(10) DEFAULT 'external' NOT NULL,
  "status" varchar(20) NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."broken_links"
    ADD CONSTRAINT "broken_links_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blk_site_run_idx" ON "ob_cms"."broken_links" USING btree ("site_id","run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blk_run_idx" ON "ob_cms"."broken_links" USING btree ("run_id");
--> statement-breakpoint

-- 3. site_domains — SSL/cert-expiry monitoring columns.
ALTER TABLE "ob_cms"."site_domains" ADD COLUMN IF NOT EXISTS "tls_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ob_cms"."site_domains" ADD COLUMN IF NOT EXISTS "tls_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ob_cms"."site_domains" ADD COLUMN IF NOT EXISTS "tls_check_error" varchar(500);
