-- CONTENT-OPS — draft preview links, soft concurrent-edit locking, and
-- scheduled unpublish / content expiry, for pages AND blog posts.
--
--   1. pages/posts: `expires_at` (auto-unpublish when past) + `preview_token`
--      (per-row nonce; the shareable HMAC link is derived from it, and
--      nulling/rotating it revokes previously-issued links).
--   2. content_locks: one advisory lock per (site, entity_type, entity_id),
--      heartbeat-driven staleness. Never hard-blocks a save.
--
-- Every statement is IF NOT EXISTS / duplicate-safe (re-applying is a no-op).

-- 1. Expiry + preview-token columns (additive, nullable → no regression).
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "preview_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "ob_cms"."posts" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "ob_cms"."posts" ADD COLUMN IF NOT EXISTS "preview_token" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pag_site_expires_idx" ON "ob_cms"."pages" USING btree ("site_id","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pst_site_expires_idx" ON "ob_cms"."posts" USING btree ("site_id","expires_at");
--> statement-breakpoint

-- 2. content_locks — advisory concurrent-edit locks (one row per entity).
CREATE TABLE IF NOT EXISTS "ob_cms"."content_locks" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "entity_type" varchar(10) NOT NULL,
  "entity_id" varchar(50) NOT NULL,
  "user_id" varchar(50) NOT NULL,
  "user_name" varchar(200) NOT NULL,
  "acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
  "heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."content_locks"
    ADD CONSTRAINT "content_locks_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."content_locks"
    ADD CONSTRAINT "lck_site_entity_uq" UNIQUE ("site_id","entity_type","entity_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lck_site_entity_idx" ON "ob_cms"."content_locks" USING btree ("site_id","entity_type","entity_id");
