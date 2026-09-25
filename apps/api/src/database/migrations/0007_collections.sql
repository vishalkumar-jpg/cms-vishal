-- COLLECTIONS — dynamic content types (HubDB / WP-CPT equivalent).
--
-- `collections` is a per-site, marketer-defined content type with a jsonb field
-- schema. `collection_items` hold the rows, with a free-form `data` jsonb keyed
-- by the collection's field keys, plus a draft/published lifecycle.
--
-- Both tables are tenant-private (site_id NOT NULL) so all reads/writes go
-- through the ScopedRepository hard predicate. IF NOT EXISTS so re-applying is a
-- no-op.

CREATE TABLE IF NOT EXISTS "ob_cms"."collections" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."collection_items" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"collection_id" varchar(50) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."collections" ADD CONSTRAINT "collections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."collection_items" ADD CONSTRAINT "collection_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "ob_cms"."collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."collections" ADD CONSTRAINT "col_site_slug_uq" UNIQUE("site_id","slug");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."collections" ADD CONSTRAINT "col_site_name_uq" UNIQUE("site_id","name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."collection_items" ADD CONSTRAINT "cit_collection_slug_uq" UNIQUE("collection_id","slug");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "col_site_idx" ON "ob_cms"."collections" USING btree ("site_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cit_site_collection_idx" ON "ob_cms"."collection_items" USING btree ("site_id","collection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cit_collection_status_idx" ON "ob_cms"."collection_items" USING btree ("collection_id","status");
