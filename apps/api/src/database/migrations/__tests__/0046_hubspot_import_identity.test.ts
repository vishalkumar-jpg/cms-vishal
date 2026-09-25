import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  import.meta.dir,
  "../../migrations/0046_hubspot_import_identity.sql",
);

describe("0046_hubspot_import_identity migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("adds HubSpot linkage columns to pages and posts", () => {
    expect(sql).toContain('"hubspot_connection_id"');
    expect(sql).toContain('"hubspot_kind"');
    expect(sql).toContain('"hubspot_hs_id"');
    expect(sql).toContain('ALTER TABLE "ob_cms"."pages"');
    expect(sql).toContain('ALTER TABLE "ob_cms"."posts"');
  });

  test("adds partial unique indexes for active HubSpot sources", () => {
    expect(sql).toContain('"pag_hubspot_source_active_uidx"');
    expect(sql).toContain('"pst_hubspot_source_active_uidx"');
    expect(sql).toContain('"deleted_at" IS NULL');
    expect(sql).not.toContain("CREATE UNIQUE INDEX CONCURRENTLY");
    expect(sql).toContain("no non-transactional migration runner pattern");
  });

  test("creates import_run_items ledger table", () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ob_cms"."import_run_items"');
    expect(sql).toContain('"run_id"');
    expect(sql).toContain('"hubspot_hs_id"');
    expect(sql).toContain('"hubspot_kind"');
    expect(sql).toContain('"imi_run_idx"');
  });
});
