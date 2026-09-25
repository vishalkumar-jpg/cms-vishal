import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  import.meta.dir,
  "../../migrations/0041_template_skeleton_versions.sql",
);

describe("0041_template_skeleton_versions migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("creates append-only template_skeleton_versions table", () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ob_cms"."template_skeleton_versions"');
    expect(sql).toContain('"skeleton_id" varchar(50) NOT NULL');
    expect(sql).toContain('"template_key" varchar(100) NOT NULL');
    expect(sql).toContain('"version" varchar(50) NOT NULL');
    expect(sql).toContain('"metadata" jsonb NOT NULL');
    expect(sql).toContain('"content" jsonb NOT NULL');
    expect(sql).toContain('"snapshot_digest" varchar(64) NOT NULL');
    expect(sql).toContain('"created_at" timestamp with time zone');
    expect(sql).toContain('"created_by" varchar(50)');
  });

  test("references template_skeletons with cascade delete", () => {
    expect(sql).toContain(
      'FOREIGN KEY ("skeleton_id") REFERENCES "ob_cms"."template_skeletons"("id") ON DELETE cascade',
    );
  });

  test("adds history lookup indexes", () => {
    expect(sql).toContain('"tsv_skeleton_created_idx"');
    expect(sql).toContain('"skeleton_id", "created_at" DESC');
    expect(sql).toContain('"tsv_skeleton_version_idx"');
    expect(sql).toContain('"skeleton_id", "version"');
    expect(sql).toContain('"tsv_template_key_idx"');
    expect(sql).toContain('"template_key"');
  });
});
