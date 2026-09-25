-- Durable connector import run history (one row per connection-scoped import attempt).
CREATE TABLE IF NOT EXISTS "ob_cms"."import_runs" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "deleted_at" timestamp with time zone,
  "site_id" varchar(50) NOT NULL,
  "connection_id" varchar(50) NOT NULL,
  "connector_id" varchar(50) NOT NULL,
  "account_id" varchar(50),
  "account_label" varchar(200),
  "scope" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'running',
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "result_summary" jsonb DEFAULT '{"importedPages":0,"importedPosts":0,"skipped":[]}'::jsonb NOT NULL,
  "error_message" varchar(2000),
  "correlation_key" varchar(100)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."import_runs"
    ADD CONSTRAINT "import_runs_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."import_runs"
    ADD CONSTRAINT "import_runs_connection_id_connector_connections_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "ob_cms"."connector_connections"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imr_site_idx"
  ON "ob_cms"."import_runs" USING btree ("site_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imr_connection_idx"
  ON "ob_cms"."import_runs" USING btree ("connection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imr_site_created_idx"
  ON "ob_cms"."import_runs" USING btree ("site_id", "created_at" DESC);
