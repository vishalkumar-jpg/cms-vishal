-- Immutable version snapshots for platform template skeletons.
-- Latest state remains on template_skeletons + template_skeleton_contents;
-- this table is append-only history.

CREATE TABLE IF NOT EXISTS "ob_cms"."template_skeleton_versions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"skeleton_id" varchar(50) NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"version" varchar(50) NOT NULL,
	"metadata" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"snapshot_digest" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(50)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."template_skeleton_versions" ADD CONSTRAINT "template_skeleton_versions_skeleton_id_template_skeletons_id_fk" FOREIGN KEY ("skeleton_id") REFERENCES "ob_cms"."template_skeletons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsv_skeleton_created_idx"
	ON "ob_cms"."template_skeleton_versions" USING btree ("skeleton_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsv_skeleton_version_idx"
	ON "ob_cms"."template_skeleton_versions" USING btree ("skeleton_id", "version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsv_template_key_idx"
	ON "ob_cms"."template_skeleton_versions" USING btree ("template_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tsv_skeleton_version_uidx"
	ON "ob_cms"."template_skeleton_versions" USING btree ("skeleton_id", "version");
