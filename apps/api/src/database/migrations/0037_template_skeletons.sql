-- Template skeleton storage — platform catalog metadata + editable page structure.
--
-- Metadata (`template_skeletons`) is separated from content (`template_skeleton_contents`)
-- so catalog queries stay lightweight and content can be versioned independently later.
-- NOT site-scoped — global platform starters for the template registry.

CREATE TABLE IF NOT EXISTS "ob_cms"."template_skeletons" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"template_key" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supported_page_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"schema_version" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tsk_template_key_active_uidx"
	ON "ob_cms"."template_skeletons" USING btree ("template_key")
	WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsk_status_idx" ON "ob_cms"."template_skeletons" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsk_category_idx" ON "ob_cms"."template_skeletons" USING btree ("category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."template_skeleton_contents" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"skeleton_id" varchar(50) NOT NULL,
	"layout" jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"page_structure" jsonb DEFAULT '{"defaultSectionOrder":[],"requiredSectionIds":[],"optionalSectionIds":[]}'::jsonb NOT NULL,
	"component_props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_schema_version" varchar(20) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."template_skeleton_contents" ADD CONSTRAINT "template_skeleton_contents_skeleton_id_template_skeletons_id_fk" FOREIGN KEY ("skeleton_id") REFERENCES "ob_cms"."template_skeletons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tsc_skeleton_id_uidx"
	ON "ob_cms"."template_skeleton_contents" USING btree ("skeleton_id")
	WHERE "deleted_at" IS NULL;
