-- B14 EDITORIAL WORKFLOW / APPROVALS — content moves
--   draft → in_review → approved → published
-- with a reviewer assignee + last review note. Adds workflow columns to both
-- `pages` and `posts`. All statements are IF NOT EXISTS / duplicate-safe so
-- re-applying is a no-op. Existing rows backfill workflow_state from status
-- (published rows → 'published', everything else → 'draft').

-- 1. pages workflow columns.
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "workflow_state" varchar(20) DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "reviewer_id" varchar(50);
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "review_note" varchar(1000);
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "ob_cms"."pages" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."pages"
    ADD CONSTRAINT "pages_reviewer_id_system_users_id_fk"
    FOREIGN KEY ("reviewer_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
UPDATE "ob_cms"."pages" SET "workflow_state" = CASE WHEN "status" = 'published' THEN 'published' ELSE 'draft' END
  WHERE "workflow_state" = 'draft';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pag_site_workflow_idx" ON "ob_cms"."pages" ("site_id","workflow_state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pag_site_reviewer_idx" ON "ob_cms"."pages" ("site_id","reviewer_id");
--> statement-breakpoint

-- 2. posts workflow columns.
ALTER TABLE "ob_cms"."posts" ADD COLUMN IF NOT EXISTS "workflow_state" varchar(20) DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ob_cms"."posts" ADD COLUMN IF NOT EXISTS "reviewer_id" varchar(50);
--> statement-breakpoint
ALTER TABLE "ob_cms"."posts" ADD COLUMN IF NOT EXISTS "review_note" varchar(1000);
--> statement-breakpoint
ALTER TABLE "ob_cms"."posts" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "ob_cms"."posts" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."posts"
    ADD CONSTRAINT "posts_reviewer_id_system_users_id_fk"
    FOREIGN KEY ("reviewer_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
UPDATE "ob_cms"."posts" SET "workflow_state" = CASE WHEN "status" = 'published' THEN 'published' ELSE 'draft' END
  WHERE "workflow_state" = 'draft';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pst_site_workflow_idx" ON "ob_cms"."posts" ("site_id","workflow_state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pst_site_reviewer_idx" ON "ob_cms"."posts" ("site_id","reviewer_id");
