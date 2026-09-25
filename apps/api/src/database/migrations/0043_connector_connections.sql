-- Generic connector connection storage (one row per site + connector provider).
-- Credentials are encrypted at rest; only credential_hint is safe for display.
CREATE TABLE IF NOT EXISTS "ob_cms"."connector_connections" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "deleted_at" timestamp with time zone,
  "site_id" varchar(50) NOT NULL,
  "connector_id" varchar(50) NOT NULL,
  "account_id" varchar(50),
  "encrypted_credentials" varchar(2000) NOT NULL,
  "credential_hint" varchar(40) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_connected" boolean DEFAULT true NOT NULL,
  "connected_at" timestamp with time zone,
  "last_validated_at" timestamp with time zone,
  "last_sync_at" timestamp with time zone,
  "sync_enabled" boolean DEFAULT true NOT NULL,
  "sync_state" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."connector_connections"
    ADD CONSTRAINT "connector_connections_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ccn_site_connector_uq"
  ON "ob_cms"."connector_connections" ("site_id", "connector_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ccn_site_idx"
  ON "ob_cms"."connector_connections" USING btree ("site_id");
