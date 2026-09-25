-- i18n / localization (gap B13). ADDITIVE — existing single-locale content keeps
-- working unchanged.
--
-- site_settings: a site's locale set.
--   default_locale — the canonical locale, served WITHOUT a URL prefix.
--   locales        — every locale the site publishes (always includes default).
--   Defaults ("en", ["en"]) keep existing sites single-locale.
--
-- pages / posts: per-row translation columns.
--   locale          — this row's language.
--   translation_key — shared id grouping translations of one logical page/post.
--
-- Backfill (idempotent):
--   * each content row's locale := its site's default_locale (fallback "en").
--   * each content row's translation_key := its own id → every existing page/post
--     is its own single-locale group. A future translation is a NEW row with the
--     same translation_key and a different locale.
--
-- Unique slug constraint is relaxed from (site_id, slug) to (site_id, locale,
-- slug) so /about and /es/about can coexist. Single-locale sites are unaffected.
--
-- All steps use IF [NOT] EXISTS / guarded DO blocks so re-applying is a no-op.

-- 1. site_settings locale columns ------------------------------------------------
ALTER TABLE "ob_cms"."site_settings"
  ADD COLUMN IF NOT EXISTS "default_locale" varchar(12) NOT NULL DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings"
  ADD COLUMN IF NOT EXISTS "locales" jsonb NOT NULL DEFAULT '["en"]'::jsonb;--> statement-breakpoint

-- 2. pages locale columns --------------------------------------------------------
ALTER TABLE "ob_cms"."pages"
  ADD COLUMN IF NOT EXISTS "locale" varchar(12) NOT NULL DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "ob_cms"."pages"
  ADD COLUMN IF NOT EXISTS "translation_key" varchar(50);--> statement-breakpoint

-- 3. posts locale columns --------------------------------------------------------
ALTER TABLE "ob_cms"."posts"
  ADD COLUMN IF NOT EXISTS "locale" varchar(12) NOT NULL DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "ob_cms"."posts"
  ADD COLUMN IF NOT EXISTS "translation_key" varchar(50);--> statement-breakpoint

-- 4. Backfill locale from the owning site's default_locale -----------------------
UPDATE "ob_cms"."pages" p
  SET "locale" = COALESCE(s."default_locale", 'en')
  FROM "ob_cms"."site_settings" s
  WHERE s."site_id" = p."site_id";--> statement-breakpoint
UPDATE "ob_cms"."posts" p
  SET "locale" = COALESCE(s."default_locale", 'en')
  FROM "ob_cms"."site_settings" s
  WHERE s."site_id" = p."site_id";--> statement-breakpoint

-- 5. Backfill translation_key := id (each existing row is its own group) ---------
UPDATE "ob_cms"."pages" SET "translation_key" = "id" WHERE "translation_key" IS NULL;--> statement-breakpoint
UPDATE "ob_cms"."posts" SET "translation_key" = "id" WHERE "translation_key" IS NULL;--> statement-breakpoint

-- 6. Relax slug uniqueness to (site_id, locale, slug) ----------------------------
ALTER TABLE "ob_cms"."pages" DROP CONSTRAINT IF EXISTS "pag_site_slug_uq";--> statement-breakpoint
ALTER TABLE "ob_cms"."posts" DROP CONSTRAINT IF EXISTS "pst_site_slug_uq";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."pages"
    ADD CONSTRAINT "pag_site_locale_slug_uq" UNIQUE ("site_id", "locale", "slug");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."posts"
    ADD CONSTRAINT "pst_site_locale_slug_uq" UNIQUE ("site_id", "locale", "slug");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- 7. Translation-lookup indexes --------------------------------------------------
CREATE INDEX IF NOT EXISTS "pag_site_transkey_locale_idx"
  ON "ob_cms"."pages" ("site_id", "translation_key", "locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pst_site_transkey_locale_idx"
  ON "ob_cms"."posts" ("site_id", "translation_key", "locale");
