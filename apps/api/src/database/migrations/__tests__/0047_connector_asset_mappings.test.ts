import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  import.meta.dir,
  "../../migrations/0047_connector_asset_mappings.sql",
);

describe("0047_connector_asset_mappings migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("creates connector_asset_mappings with HubSpot identity columns", () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ob_cms"."connector_asset_mappings"');
    expect(sql).toContain('"identity_key"');
    expect(sql).toContain('"source_url"');
    expect(sql).toContain('"hubspot_file_id"');
    expect(sql).toContain('"media_id"');
    expect(sql).toContain('"ob_url"');
    expect(sql).toContain('"checksum_sha256"');
  });

  test("adds partial unique index for active mappings per connection", () => {
    expect(sql).toContain('"cam_site_connection_identity_active_uidx"');
    expect(sql).toContain('"deleted_at" IS NULL');
  });
});
