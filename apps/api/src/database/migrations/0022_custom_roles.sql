-- RBAC-2 (custom granular roles) — ADDITIVE over the 4 built-in roles.
--
-- 1. `custom_roles`: per-site named permission sets (jsonb string[] subset of the
--    shared PERMISSIONS catalog). unique(site_id, name).
-- 2. `site_members.custom_role_id`: nullable pointer to a custom role. The
--    built-in `role` column is UNCHANGED and keeps driving the @Roles hierarchy,
--    so the tenant-isolation + platform-admin e2e gates are unaffected.
-- All statements are IF NOT EXISTS / duplicate-safe so re-applying is a no-op.

CREATE TABLE IF NOT EXISTS "ob_cms"."custom_roles" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" varchar(500),
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_builtin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."custom_roles"
    ADD CONSTRAINT "custom_roles_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."custom_roles"
    ADD CONSTRAINT "crl_site_name_uq" UNIQUE ("site_id","name");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crl_site_idx" ON "ob_cms"."custom_roles" USING btree ("site_id");
--> statement-breakpoint
ALTER TABLE "ob_cms"."site_members" ADD COLUMN IF NOT EXISTS "custom_role_id" varchar(50);
