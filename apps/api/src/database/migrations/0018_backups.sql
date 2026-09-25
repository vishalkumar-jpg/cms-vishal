-- E26 — PLATFORM-level database backup / restore ledger.
--
-- Cross-tenant (super-admin) feature: a backup is a full pg_dump of the whole
-- cluster, so there is intentionally NO site_id column / FK. The API inserts a
-- `pending` row; the worker's backup processor advances it through
-- running → completed/failed and records size + storage key.
-- All statements are IF NOT EXISTS / duplicate-safe so re-applying is a no-op.

CREATE TABLE IF NOT EXISTS "ob_cms"."backups" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "filename" varchar(300) NOT NULL,
  "size_bytes" bigint,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "kind" varchar(20) DEFAULT 'manual' NOT NULL,
  "storage_key" varchar(500),
  "error" varchar(2000),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bak_status_createdat_idx" ON "ob_cms"."backups" USING btree ("status","created_at");
