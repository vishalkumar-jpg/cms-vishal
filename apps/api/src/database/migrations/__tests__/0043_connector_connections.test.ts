import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(import.meta.dir, "../../migrations/0043_connector_connections.sql");

describe("0043_connector_connections migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("creates generic connector_connections table", () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ob_cms"."connector_connections"');
    expect(sql).toContain('"connector_id" varchar(50) NOT NULL');
    expect(sql).toContain('"account_id" varchar(50)');
    expect(sql).toContain('"encrypted_credentials" varchar(2000) NOT NULL');
    expect(sql).toContain('"credential_hint" varchar(40) NOT NULL');
    expect(sql).toContain('"metadata" jsonb DEFAULT \'{}\'::jsonb NOT NULL');
  });

  test("enforces one active connection per site and connector", () => {
    expect(sql).toContain('"ccn_site_connector_uq"');
    expect(sql).toContain('"site_id", "connector_id"');
    expect(sql).toContain('"deleted_at" IS NULL');
  });

  test("references sites with cascade delete", () => {
    expect(sql).toContain(
      'FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade',
    );
  });
});
