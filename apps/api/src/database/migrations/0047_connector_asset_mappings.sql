-- J1: HubSpot (and future connectors) source asset → OB media mappings.
CREATE TABLE IF NOT EXISTS "ob_cms"."connector_asset_mappings" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "connection_id" varchar(50) NOT NULL,
  "source_system" varchar(30) NOT NULL,
  "identity_key" varchar(500) NOT NULL,
  "source_url" varchar(2000) NOT NULL,
  "hubspot_file_id" varchar(200),
  "discovered_at_path" varchar(500),
  "media_id" varchar(50),
  "ob_url" varchar(1000),
  "status" varchar(20) NOT NULL,
  "content_type" varchar(100),
  "byte_size" bigint,
  "checksum_sha256" varchar(64),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error" varchar(2000)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."connector_asset_mappings"
    ADD CONSTRAINT "connector_asset_mappings_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."connector_asset_mappings"
    ADD CONSTRAINT "connector_asset_mappings_connection_id_connector_connections_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "ob_cms"."connector_connections"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."connector_asset_mappings"
    ADD CONSTRAINT "connector_asset_mappings_media_id_media_id_fk"
    FOREIGN KEY ("media_id") REFERENCES "ob_cms"."media"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cam_site_connection_identity_active_uidx"
  ON "ob_cms"."connector_asset_mappings" ("site_id", "connection_id", "identity_key")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cam_connection_idx"
  ON "ob_cms"."connector_asset_mappings" USING btree ("connection_id");
