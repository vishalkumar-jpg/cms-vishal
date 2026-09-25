-- AUTH HARDENING (gap C21) — refresh-token rotation/revocation + 2FA (TOTP).
--
-- 1. system_users: add encrypted TOTP secret + enabled flag (2FA).
-- 2. refresh_tokens: server-side ledger of issued refresh tokens (hashed),
--    enabling rotation + revocation (logout invalidates them; reuse → revoke).
-- All statements are duplicate-safe so re-applying is a no-op.

ALTER TABLE "ob_cms"."system_users" ADD COLUMN IF NOT EXISTS "totp_secret" text;
--> statement-breakpoint
ALTER TABLE "ob_cms"."system_users"
  ADD COLUMN IF NOT EXISTS "totp_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ob_cms"."refresh_tokens" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "user_id" varchar(50) NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_system_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rft_token_hash_idx" ON "ob_cms"."refresh_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rft_user_idx" ON "ob_cms"."refresh_tokens" USING btree ("user_id");
