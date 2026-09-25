-- Per-page layout chrome options: inherit homepage topbar/navbar/footer by default
-- and allow each page to hide individual chrome slots.
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "layout_options" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
