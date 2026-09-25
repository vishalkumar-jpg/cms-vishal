-- NOTIFICATIONS — in-app header-bell notifications.
--
-- One row per (recipient, event). Site-scoped + soft-delete (baseColumns). A
-- notification is delivered to exactly ONE recipient (recipient_user_id);
-- fan-out (a comment notifying several thread participants) is N rows. read_at
-- null ⇒ unread (drives the badge count). Notifications are best-effort
-- side-effects of the source action and never block it.
--
-- Every statement is IF NOT EXISTS / duplicate-safe (re-applying is a no-op).

CREATE TABLE IF NOT EXISTS "ob_cms"."notifications" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "recipient_user_id" varchar(50) NOT NULL,
  "type" varchar(40) NOT NULL,
  "title" varchar(300) NOT NULL,
  "body" varchar(2000),
  "entity_type" varchar(40),
  "entity_id" varchar(50),
  "link" varchar(500),
  "actor_user_id" varchar(50),
  "read_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."notifications"
    ADD CONSTRAINT "notifications_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ntf_site_recipient_idx" ON "ob_cms"."notifications" USING btree ("site_id","recipient_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ntf_site_recipient_read_idx" ON "ob_cms"."notifications" USING btree ("site_id","recipient_user_id","read_at");
