-- Template skeleton preview assets — metadata references only (no binary storage).
--
-- gallery_image rows may repeat per skeleton; thumbnail/cover_image/icon/video_preview
-- are singletons (enforced by partial unique index on active rows).

CREATE TABLE IF NOT EXISTS "ob_cms"."template_skeleton_assets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"skeleton_id" varchar(50) NOT NULL,
	"asset_type" varchar(30) NOT NULL,
	"storage_key" varchar(500),
	"url" varchar(2000) NOT NULL,
	"mime_type" varchar(100),
	"width" integer,
	"height" integer,
	"size" integer,
	"alt_text" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."template_skeleton_assets" ADD CONSTRAINT "template_skeleton_assets_skeleton_id_template_skeletons_id_fk" FOREIGN KEY ("skeleton_id") REFERENCES "ob_cms"."template_skeletons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsa_skeleton_idx" ON "ob_cms"."template_skeleton_assets" USING btree ("skeleton_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsa_skeleton_type_idx" ON "ob_cms"."template_skeleton_assets" USING btree ("skeleton_id", "asset_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tsa_skeleton_singleton_uidx"
	ON "ob_cms"."template_skeleton_assets" USING btree ("skeleton_id", "asset_type")
	WHERE "deleted_at" IS NULL AND "asset_type" IN ('thumbnail', 'cover_image', 'icon', 'video_preview');
