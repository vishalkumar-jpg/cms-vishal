CREATE TABLE IF NOT EXISTS "ob_cms"."pages" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"draft_layout" jsonb,
	"published_layout" jsonb,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parent_id" varchar(50),
	"schema_version" varchar(20) DEFAULT '2.0' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	CONSTRAINT "pag_site_slug_uq" UNIQUE("site_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."page_versions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"page_id" varchar(50) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"label" varchar(200),
	"author_id" varchar(50)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."posts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"excerpt" varchar(600),
	"layout" jsonb,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cover_media_id" varchar(50),
	"author_id" varchar(50),
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	CONSTRAINT "pst_site_slug_uq" UNIQUE("site_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."post_terms" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"post_id" varchar(50) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	CONSTRAINT "ptm_post_kind_slug_uq" UNIQUE("post_id","kind","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."media" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"url" varchar(1000),
	"type" varchar(100) NOT NULL,
	"alt" varchar(500),
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"size" bigint,
	"width" integer,
	"height" integer,
	"variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"uploaded_by" varchar(50)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."navigation" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"location" varchar(40) NOT NULL,
	"tree" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "nav_site_location_uq" UNIQUE("site_id","location")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."themes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"preset" varchar(60) DEFAULT 'default' NOT NULL,
	"tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"brand" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "themes_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."redirects" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"from_path" varchar(1000) NOT NULL,
	"to_path" varchar(1000) NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	CONSTRAINT "rdr_site_from_uq" UNIQUE("site_id","from_path")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."page_templates" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50),
	"name" varchar(200) NOT NULL,
	"kind" varchar(20) DEFAULT 'page' NOT NULL,
	"layout" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."page_versions" ADD CONSTRAINT "page_versions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."page_versions" ADD CONSTRAINT "page_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "ob_cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."page_versions" ADD CONSTRAINT "page_versions_author_id_system_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."posts" ADD CONSTRAINT "posts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."posts" ADD CONSTRAINT "posts_author_id_system_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."post_terms" ADD CONSTRAINT "post_terms_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."post_terms" ADD CONSTRAINT "post_terms_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "ob_cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."media" ADD CONSTRAINT "media_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."media" ADD CONSTRAINT "media_uploaded_by_system_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."navigation" ADD CONSTRAINT "navigation_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."themes" ADD CONSTRAINT "themes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."redirects" ADD CONSTRAINT "redirects_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."page_templates" ADD CONSTRAINT "page_templates_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pag_site_status_idx" ON "ob_cms"."pages" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pag_parent_idx" ON "ob_cms"."pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pvr_page_idx" ON "ob_cms"."page_versions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pst_site_status_idx" ON "ob_cms"."posts" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ptm_site_kind_idx" ON "ob_cms"."post_terms" USING btree ("site_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "med_site_idx" ON "ob_cms"."media" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "med_site_type_idx" ON "ob_cms"."media" USING btree ("site_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nav_site_idx" ON "ob_cms"."navigation" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rdr_site_idx" ON "ob_cms"."redirects" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tpl_site_kind_idx" ON "ob_cms"."page_templates" USING btree ("site_id","kind");
