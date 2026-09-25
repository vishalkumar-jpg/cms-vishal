-- COLLAB (builder comments) — one new tenant-private table `page_comments`.
--
-- A comment is either a thread root (parent_id NULL) or a flat reply (parent_id
-- → the root). `thread_id` always points at the root so a thread groups with a
-- single indexed read. A thread anchors to a Craft node (`node_id`) OR to a free
-- canvas point (`anchor_x`/`anchor_y`, 0..1 fractions). `resolved` toggles the
-- whole thread open/closed. All statements are IF NOT EXISTS / duplicate-safe so
-- re-applying is a no-op.

CREATE TABLE IF NOT EXISTS "ob_cms"."page_comments" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "page_id" varchar(50) NOT NULL,
  "thread_id" varchar(50) NOT NULL,
  "parent_id" varchar(50),
  "node_id" varchar(100),
  "anchor_x" double precision,
  "anchor_y" double precision,
  "body" varchar(4000) NOT NULL,
  "author_id" varchar(50) NOT NULL,
  "resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."page_comments"
    ADD CONSTRAINT "page_comments_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."page_comments"
    ADD CONSTRAINT "page_comments_page_id_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "ob_cms"."pages"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cmt_site_page_idx" ON "ob_cms"."page_comments" USING btree ("site_id","page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cmt_thread_idx" ON "ob_cms"."page_comments" USING btree ("thread_id");
