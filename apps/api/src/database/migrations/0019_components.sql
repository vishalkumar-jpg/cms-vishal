-- COMPONENTS — reusable blocks upgraded into true design-system components.
--
-- Additive: two nullable jsonb columns on the existing `reusable_blocks` table.
--   `props`    — the component's declared, editable props (array of
--                { key, label, type, default, options? }).
--   `variants` — optional named prop-presets (array of { name, label, values }).
--
-- Slot markers + componentBindings live inside the existing `layout` jsonb
-- (per-node `isSlot`/`slotName`/`componentBinding`), so no column is needed for
-- those. Existing rows keep NULL props/variants and resolve exactly as before
-- (backward-compatible). IF NOT EXISTS so re-applying is a no-op.

ALTER TABLE "ob_cms"."reusable_blocks" ADD COLUMN IF NOT EXISTS "props" jsonb;
--> statement-breakpoint
ALTER TABLE "ob_cms"."reusable_blocks" ADD COLUMN IF NOT EXISTS "variants" jsonb;
