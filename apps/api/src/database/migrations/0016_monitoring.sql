-- MONITORING HUB (backlog #29 / #37 / #30) — two new tenant-private tables.
--
-- #29 (CRM-sync) adds NO table: it reads the existing forms→CRM delivery
-- state-machine on `form_submissions`. #37 + #30 add the two tables below.
-- All statements are IF NOT EXISTS / duplicate-safe so re-applying is a no-op.

-- 1. runtime_errors (#37): deduped client/server error reports per site.
CREATE TABLE IF NOT EXISTS "ob_cms"."runtime_errors" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "source" varchar(20) DEFAULT 'renderer' NOT NULL,
  "message" varchar(2000) NOT NULL,
  "stack" varchar(8000),
  "url" varchar(2000),
  "user_agent" varchar(1000),
  "count" integer DEFAULT 1 NOT NULL,
  "first_seen" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."runtime_errors"
    ADD CONSTRAINT "runtime_errors_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rte_site_lastseen_idx" ON "ob_cms"."runtime_errors" USING btree ("site_id","last_seen");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rte_dedupe_idx" ON "ob_cms"."runtime_errors" USING btree ("site_id","source","message","url");
--> statement-breakpoint

-- 2. page_audits (#30): page-audit / certification score rows (Lighthouse seam).
CREATE TABLE IF NOT EXISTS "ob_cms"."page_audits" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "page_id" varchar(50),
  "path" varchar(500) NOT NULL,
  "status" varchar(20) DEFAULT 'seam' NOT NULL,
  "performance_score" integer,
  "accessibility_score" integer,
  "seo_score" integer,
  "best_practices_score" integer,
  "lcp" double precision,
  "cls" double precision,
  "ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."page_audits"
    ADD CONSTRAINT "page_audits_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pau_site_path_idx" ON "ob_cms"."page_audits" USING btree ("site_id","path","ran_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pau_site_ranat_idx" ON "ob_cms"."page_audits" USING btree ("site_id","ran_at");
