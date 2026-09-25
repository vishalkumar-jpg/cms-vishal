-- CONTENT API (gap E27) — public read-only Content API keys + outbound webhooks.
--
-- Three tenant-private tables (all carry site_id NOT NULL → ScopedRepository hard
-- predicate). All statements are IF NOT EXISTS / duplicate-safe so re-applying is
-- a no-op.

-- 1. api_keys: per-site keys for the public Content API. Plaintext is shown once
--    on creation and NEVER stored — only a SHA-256 hash + a non-secret prefix.
CREATE TABLE IF NOT EXISTS "ob_cms"."api_keys" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "key_prefix" varchar(40) NOT NULL,
  "key_hash" varchar(128) NOT NULL,
  "scopes" jsonb DEFAULT '["read"]'::jsonb NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."api_keys"
    ADD CONSTRAINT "api_keys_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."api_keys" ADD CONSTRAINT "apk_key_hash_uq" UNIQUE("key_hash");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apk_site_idx" ON "ob_cms"."api_keys" USING btree ("site_id");
--> statement-breakpoint

-- 2. webhooks: per-site outbound webhook subscriptions.
CREATE TABLE IF NOT EXISTS "ob_cms"."webhooks" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "url" varchar(1000) NOT NULL,
  "events" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "secret" varchar(200) NOT NULL,
  "active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."webhooks"
    ADD CONSTRAINT "webhooks_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whk_site_idx" ON "ob_cms"."webhooks" USING btree ("site_id");
--> statement-breakpoint

-- 3. webhook_deliveries: attempt log + retry ledger.
CREATE TABLE IF NOT EXISTS "ob_cms"."webhook_deliveries" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "webhook_id" varchar(50) NOT NULL,
  "event" varchar(80) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "status_code" integer,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" varchar(1000),
  "delivered_at" timestamp with time zone,
  "next_retry_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk"
    FOREIGN KEY ("webhook_id") REFERENCES "ob_cms"."webhooks"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whd_site_idx" ON "ob_cms"."webhook_deliveries" USING btree ("site_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whd_webhook_idx" ON "ob_cms"."webhook_deliveries" USING btree ("webhook_id");
