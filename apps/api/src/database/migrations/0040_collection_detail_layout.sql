-- Collection-owned shared detail layout (ADR 0001).
-- One SerializedLayout per collection for /c/{collection}/{item} rendering.
-- Nullable: existing rows stay NULL → renderer keeps the generic field fallback.
-- No data backfill.

ALTER TABLE "ob_cms"."collections" ADD COLUMN IF NOT EXISTS "detail_layout" jsonb;
--> statement-breakpoint
