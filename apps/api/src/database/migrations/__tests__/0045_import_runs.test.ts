import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(import.meta.dir, "../../migrations/0045_import_runs.sql");

describe("0045_import_runs migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("creates import_runs table", () => {
    expect(sql).toContain('"ob_cms"."import_runs"');
    expect(sql).toContain('"connection_id"');
    expect(sql).toContain('"result_summary"');
  });

  test("adds foreign keys to sites and connector_connections", () => {
    expect(sql).toContain("import_runs_site_id_sites_id_fk");
    expect(sql).toContain("import_runs_connection_id_connector_connections_id_fk");
  });

  test("adds lookup indexes", () => {
    expect(sql).toContain('"imr_site_idx"');
    expect(sql).toContain('"imr_connection_idx"');
    expect(sql).toContain('"imr_site_created_idx"');
  });
});
