-- MEDIA OPTIMIZATION (gap D23) — responsive variants, focal point / crop,
-- folders and where-used tracking. All additive + idempotent.

-- 1. media_folders: per-site folder tree for organizing the library.
CREATE TABLE IF NOT EXISTS "ob_cms"."media_folders" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "parent_id" varchar(50)
);

DO $$ BEGIN
  ALTER TABLE "ob_cms"."media_folders"
    ADD CONSTRAINT "media_folders_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "mdf_site_idx" ON "ob_cms"."media_folders" ("site_id");
CREATE INDEX IF NOT EXISTS "mdf_parent_idx" ON "ob_cms"."media_folders" ("parent_id");

-- 2. media: focal point, crop params, folder ref. (`variants`/`width`/`height`
--    already exist on the table; default the variants column to a JSON array.)
ALTER TABLE "ob_cms"."media"
  ADD COLUMN IF NOT EXISTS "focal_point" jsonb DEFAULT '{"x":0.5,"y":0.5}'::jsonb NOT NULL;
ALTER TABLE "ob_cms"."media"
  ADD COLUMN IF NOT EXISTS "crop_rect" jsonb;
ALTER TABLE "ob_cms"."media"
  ADD COLUMN IF NOT EXISTS "folder_id" varchar(50);

-- Switch `variants` default from {} to [] (array shape the worker writes).
ALTER TABLE "ob_cms"."media" ALTER COLUMN "variants" SET DEFAULT '[]'::jsonb;
UPDATE "ob_cms"."media" SET "variants" = '[]'::jsonb
  WHERE "variants" = '{}'::jsonb OR "variants" IS NULL;

CREATE INDEX IF NOT EXISTS "med_folder_idx" ON "ob_cms"."media" ("folder_id");
