-- REUSE-BLOCKS — reusable / global synced blocks (per site).
--
-- A reusable block is a named, self-contained SerializedLayout fragment that
-- pages REFERENCE (not copy) via a `ReusableBlock` block. Editing this row
-- updates EVERY instance ("edit once, update everywhere"). Distinct from
-- page_templates, which are one-time COPIES.
--
-- siteId is NOT NULL (tenant-private), so reads/writes go through the
-- ScopedRepository hard predicate. IF NOT EXISTS so re-applying is a no-op.

CREATE TABLE IF NOT EXISTS "ob_cms"."reusable_blocks" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"layout" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."reusable_blocks" ADD CONSTRAINT "reusable_blocks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rub_site_idx" ON "ob_cms"."reusable_blocks" USING btree ("site_id");
