-- ANALYTICS PIPELINE (Phase 2a) — two new tenant-private tables.
--
-- First-party, privacy-friendly product analytics. `analytics_events` is the
-- raw beacon stream (pageviews + web-vitals + custom events, NO PII, TTL-friendly)
-- and `analytics_daily` is the per-(site,day,path) rollup the worker populates
-- hourly so the stats API is fast. All statements are IF NOT EXISTS /
-- duplicate-safe so re-applying is a no-op.

-- 1. analytics_events (raw beacon stream).
CREATE TABLE IF NOT EXISTS "ob_cms"."analytics_events" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "ts" timestamp with time zone DEFAULT now() NOT NULL,
  "type" varchar(20) NOT NULL,
  "path" varchar(1000) DEFAULT '/' NOT NULL,
  "referrer" varchar(1000),
  "source" varchar(20) DEFAULT 'direct' NOT NULL,
  "medium" varchar(120),
  "campaign" varchar(200),
  "visitor_id" varchar(60) NOT NULL,
  "session_id" varchar(60) NOT NULL,
  "device_type" varchar(10) DEFAULT 'desktop' NOT NULL,
  "metric" varchar(10),
  "value" double precision,
  "name" varchar(120)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."analytics_events"
    ADD CONSTRAINT "analytics_events_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aev_site_ts_idx" ON "ob_cms"."analytics_events" USING btree ("site_id","ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aev_site_type_ts_idx" ON "ob_cms"."analytics_events" USING btree ("site_id","type","ts");
--> statement-breakpoint

-- 2. analytics_daily (per-(site,day,path) rollup).
CREATE TABLE IF NOT EXISTS "ob_cms"."analytics_daily" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "day" varchar(10) NOT NULL,
  "path" varchar(1000) DEFAULT '/' NOT NULL,
  "pageviews" integer DEFAULT 0 NOT NULL,
  "visitors" integer DEFAULT 0 NOT NULL,
  "sessions" integer DEFAULT 0 NOT NULL,
  "session_seconds" integer DEFAULT 0 NOT NULL,
  "bounced_sessions" integer DEFAULT 0 NOT NULL,
  "sources" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "devices" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."analytics_daily"
    ADD CONSTRAINT "analytics_daily_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adl_site_day_idx" ON "ob_cms"."analytics_daily" USING btree ("site_id","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adl_site_day_path_idx" ON "ob_cms"."analytics_daily" USING btree ("site_id","day","path");
--> statement-breakpoint
-- Idempotent-upsert key for the hourly rollup (one row per site+day+path).
CREATE UNIQUE INDEX IF NOT EXISTS "adl_site_day_path_uidx" ON "ob_cms"."analytics_daily" USING btree ("site_id","day","path");
