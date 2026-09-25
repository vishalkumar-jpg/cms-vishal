-- HubSpot connection-scoped import identity on pages/posts + per-item run ledger.
--
-- Index DDL uses standard CREATE UNIQUE INDEX (not CONCURRENTLY). drizzle-orm's
-- node-postgres migrator applies each migration file inside a single transaction,
-- and PostgreSQL rejects CREATE INDEX CONCURRENTLY in a transaction block. This
-- repo has no non-transactional migration runner pattern (see 0044 comment).
-- Nullable HubSpot linkage columns on existing pages/posts are additive; brief
-- index locks at rollout are acceptable versus a one-off migration path.

ALTER TABLE "ob_cms"."pages"
  ADD COLUMN IF NOT EXISTS "hubspot_connection_id" varchar(50),
  ADD COLUMN IF NOT EXISTS "hubspot_kind" varchar(20),
  ADD COLUMN IF NOT EXISTS "hubspot_hs_id" varchar(64);
--> statement-breakpoint
ALTER TABLE "ob_cms"."posts"
  ADD COLUMN IF NOT EXISTS "hubspot_connection_id" varchar(50),
  ADD COLUMN IF NOT EXISTS "hubspot_kind" varchar(20),
  ADD COLUMN IF NOT EXISTS "hubspot_hs_id" varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pag_hubspot_source_active_uidx"
  ON "ob_cms"."pages" ("site_id", "hubspot_connection_id", "hubspot_kind", "hubspot_hs_id")
  WHERE "deleted_at" IS NULL
    AND "hubspot_connection_id" IS NOT NULL
    AND "hubspot_kind" IS NOT NULL
    AND "hubspot_hs_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pst_hubspot_source_active_uidx"
  ON "ob_cms"."posts" ("site_id", "hubspot_connection_id", "hubspot_kind", "hubspot_hs_id")
  WHERE "deleted_at" IS NULL
    AND "hubspot_connection_id" IS NOT NULL
    AND "hubspot_kind" IS NOT NULL
    AND "hubspot_hs_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."import_run_items" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "run_id" varchar(50) NOT NULL,
  "hubspot_hs_id" varchar(64) NOT NULL,
  "hubspot_kind" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL,
  "ob_entity_type" varchar(20),
  "ob_entity_id" varchar(50),
  "error" varchar(2000),
  "finished_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."import_run_items"
    ADD CONSTRAINT "import_run_items_run_id_import_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "ob_cms"."import_runs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imi_run_idx"
  ON "ob_cms"."import_run_items" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imi_run_status_idx"
  ON "ob_cms"."import_run_items" USING btree ("run_id", "status");
