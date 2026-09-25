-- PHASE 4 — A/B experiments + personalization. `experiments` (a site/page-scoped
-- test with a goal) + weighted `experiment_variants` (the arms). Assignment is
-- DETERMINISTIC + STICKY per visitor (hash(visitorId+experimentId) weighted by
-- variant weights) so no assignment rows are stored. Exposures & conversions are
-- recorded on `analytics_events` (two new nullable dimension columns), keeping
-- the PII-free stream intact. All tenant-private (site_id FK, cascade on site
-- delete). Every statement is IF NOT EXISTS / duplicate-safe (re-applying is a
-- no-op).

-- 0. analytics_events: A/B dimensions (exposure/conversion tagging). Additive +
--    nullable so existing rows/inserts are unaffected.
ALTER TABLE "ob_cms"."analytics_events" ADD COLUMN IF NOT EXISTS "experiment_id" varchar(50);
--> statement-breakpoint
ALTER TABLE "ob_cms"."analytics_events" ADD COLUMN IF NOT EXISTS "variant" varchar(20);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aev_site_experiment_idx" ON "ob_cms"."analytics_events" USING btree ("site_id","experiment_id");
--> statement-breakpoint

-- 1. experiments (a test with a goal, optionally page-scoped).
CREATE TABLE IF NOT EXISTS "ob_cms"."experiments" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" varchar(500),
  "page_id" varchar(50),
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "goal_type" varchar(20) DEFAULT 'pageview' NOT NULL,
  "goal_path" varchar(1000),
  "started_at" timestamp with time zone,
  "winner_variant_id" varchar(50)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."experiments"
    ADD CONSTRAINT "experiments_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exp_site_idx" ON "ob_cms"."experiments" USING btree ("site_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exp_site_status_idx" ON "ob_cms"."experiments" USING btree ("site_id","status");
--> statement-breakpoint

-- 2. experiment_variants (weighted arms; one control per experiment).
CREATE TABLE IF NOT EXISTS "ob_cms"."experiment_variants" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "experiment_id" varchar(50) NOT NULL,
  "key" varchar(20) NOT NULL,
  "name" varchar(200) NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL,
  "is_control" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."experiment_variants"
    ADD CONSTRAINT "experiment_variants_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."experiment_variants"
    ADD CONSTRAINT "experiment_variants_experiment_id_experiments_id_fk"
    FOREIGN KEY ("experiment_id") REFERENCES "ob_cms"."experiments"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "evr_experiment_key_uidx" ON "ob_cms"."experiment_variants" USING btree ("experiment_id","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evr_site_experiment_idx" ON "ob_cms"."experiment_variants" USING btree ("site_id","experiment_id");
