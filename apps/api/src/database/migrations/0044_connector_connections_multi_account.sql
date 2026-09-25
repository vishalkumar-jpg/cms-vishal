-- Allow multiple active connections per site + connector (one row per provider account).
--
-- Index DDL uses standard CREATE/DROP INDEX (not CONCURRENTLY). drizzle-orm's
-- node-postgres migrator applies each migration file inside a single transaction,
-- and PostgreSQL rejects CREATE INDEX CONCURRENTLY in a transaction block. This
-- repo has no non-transactional migration runner pattern. connector_connections
-- is new in 0043 with expected low row volume at rollout; brief index locks are
-- acceptable versus introducing a one-off migration path for this PR.
DROP INDEX IF EXISTS "ob_cms"."ccn_site_connector_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ccn_site_connector_account_uq"
  ON "ob_cms"."connector_connections" ("site_id", "connector_id", "account_id")
  WHERE "deleted_at" IS NULL AND "account_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ccn_site_connector_idx"
  ON "ob_cms"."connector_connections" ("site_id", "connector_id");
