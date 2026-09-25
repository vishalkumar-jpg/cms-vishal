-- PHASE 5 — Revenue & orchestration. Marketing attribution
-- (`attribution_conversions`; touchpoints are derived on-read from
-- `analytics_events`) + a workflow/automation engine (`workflows` +
-- `workflow_actions` + `workflow_runs`). All tenant-private (site_id FK, cascade
-- on site delete). Every statement is IF NOT EXISTS / duplicate-safe (re-applying
-- is a no-op).

-- 1. attribution_conversions (a durable conversion, optionally with revenue).
CREATE TABLE IF NOT EXISTS "ob_cms"."attribution_conversions" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "ts" timestamp with time zone DEFAULT now() NOT NULL,
  "visitor_id" varchar(60) NOT NULL,
  "identity_id" varchar(50),
  "type" varchar(40) DEFAULT 'conversion' NOT NULL,
  "label" varchar(200),
  "value" double precision DEFAULT 0 NOT NULL,
  "landing_path" varchar(1000),
  "meta" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."attribution_conversions"
    ADD CONSTRAINT "attribution_conversions_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "atc_site_ts_idx" ON "ob_cms"."attribution_conversions" USING btree ("site_id","ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "atc_site_visitor_idx" ON "ob_cms"."attribution_conversions" USING btree ("site_id","visitor_id");
--> statement-breakpoint

-- 2. workflows (a trigger + status; actions live in a child table).
CREATE TABLE IF NOT EXISTS "ob_cms"."workflows" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "status" varchar(20) DEFAULT 'paused' NOT NULL,
  "trigger" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."workflows"
    ADD CONSTRAINT "workflows_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wkf_site_idx" ON "ob_cms"."workflows" USING btree ("site_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wkf_site_status_idx" ON "ob_cms"."workflows" USING btree ("site_id","status");
--> statement-breakpoint

-- 3. workflow_actions (an ordered step with a typed config).
CREATE TABLE IF NOT EXISTS "ob_cms"."workflow_actions" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "workflow_id" varchar(50) NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "type" varchar(40) NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."workflow_actions"
    ADD CONSTRAINT "workflow_actions_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."workflow_actions"
    ADD CONSTRAINT "workflow_actions_workflow_id_workflows_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "ob_cms"."workflows"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wac_site_workflow_idx" ON "ob_cms"."workflow_actions" USING btree ("site_id","workflow_id");
--> statement-breakpoint

-- 4. workflow_runs (one run per (workflow, subject) firing; auditability + dedupe).
CREATE TABLE IF NOT EXISTS "ob_cms"."workflow_runs" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "workflow_id" varchar(50) NOT NULL,
  "subject_type" varchar(20) DEFAULT 'visitor' NOT NULL,
  "subject_id" varchar(60) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "step_index" integer DEFAULT 0 NOT NULL,
  "run_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "log" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."workflow_runs"
    ADD CONSTRAINT "workflow_runs_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."workflow_runs"
    ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "ob_cms"."workflows"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wrn_site_workflow_idx" ON "ob_cms"."workflow_runs" USING btree ("site_id","workflow_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wrn_status_runat_idx" ON "ob_cms"."workflow_runs" USING btree ("status","run_at");
--> statement-breakpoint
-- Dedupe: at most one run per (workflow, subject). The trigger hooks upsert on
-- this so a re-fire for the same subject does not spawn duplicate runs.
CREATE UNIQUE INDEX IF NOT EXISTS "wrn_workflow_subject_uidx" ON "ob_cms"."workflow_runs" USING btree ("workflow_id","subject_id");
