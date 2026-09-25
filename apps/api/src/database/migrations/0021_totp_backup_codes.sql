-- C21 (2FA QR + backup codes) — one new table `totp_backup_codes`.
--
-- Single-use 2FA recovery codes. Only the SHA-256 hash of each raw code is
-- stored (raw codes are shown to the user exactly once at enable/regenerate).
-- At login a presented backup code is hashed and matched against the user's
-- UNUSED rows; a match sets `used_at`. Regenerating soft-deletes the prior set
-- and inserts a fresh batch; disabling 2FA deletes every row for the user (FK
-- ON DELETE CASCADE covers user deletion). All statements are IF NOT EXISTS /
-- duplicate-safe so re-applying is a no-op.

CREATE TABLE IF NOT EXISTS "ob_cms"."totp_backup_codes" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "user_id" varchar(50) NOT NULL,
  "code_hash" varchar(128) NOT NULL,
  "used_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."totp_backup_codes"
    ADD CONSTRAINT "totp_backup_codes_user_id_system_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bkc_user_idx" ON "ob_cms"."totp_backup_codes" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bkc_code_hash_idx" ON "ob_cms"."totp_backup_codes" USING btree ("code_hash");
