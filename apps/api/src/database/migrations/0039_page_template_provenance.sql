-- Phase 3 — display-only template provenance on pages.
-- Snapshot of origin at instantiate time; no FK, no indexes, no live link.
-- Existing rows stay NULL (blank create / pre-provenance pages).

ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "source_template_id" varchar(50);
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "source_template_key" varchar(100);
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "source_template_version" varchar(50);
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "instantiated_at" timestamp with time zone;
--> statement-breakpoint
