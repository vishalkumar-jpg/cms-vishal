/**
 * Export Office Beacon reusable blocks into the idempotent seed fixture.
 *
 * Reads live rows from PostgreSQL (source of truth) and writes committed JSON.
 * Site association is resolved at seed time via subdomain — site_id is NOT exported.
 *
 * Run: bun scripts/export-officebeacon-reusable-blocks.mjs
 * Env: DATABASE_URL, OB_SITE_SUBDOMAIN (default officebeacon)
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(
  ROOT,
  "apps/api/src/database/seed/fixtures/officebeacon-reusable-blocks.json",
);
const SITE_SUBDOMAIN = process.env.OB_SITE_SUBDOMAIN ?? "officebeacon";
const DEFAULT_DATABASE_URL = "postgresql://obcms:obcms@127.0.0.1:5432/obcms";

function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^DATABASE_URL=(.+)$/);
      if (m) process.env.DATABASE_URL = m[1].trim();
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const require = createRequire(join(ROOT, "apps/api/package.json"));
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});
await client.connect();

const { rows } = await client.query(
  `SELECT
      rb.id,
      rb.name,
      rb.layout,
      rb.props,
      rb.variants,
      rb.created_at,
      rb.updated_at,
      rb.created_by,
      rb.updated_by
     FROM ob_cms.reusable_blocks rb
     JOIN ob_cms.sites s ON s.id = rb.site_id
    WHERE s.subdomain = $1
      AND rb.deleted_at IS NULL
      AND s.deleted_at IS NULL
    ORDER BY rb.name ASC`,
  [SITE_SUBDOMAIN],
);

await client.end();

if (!rows.length) {
  console.error(`No reusable blocks found for site subdomain=${SITE_SUBDOMAIN}`);
  process.exit(1);
}

const payload = rows.map((row) => ({
  id: row.id,
  name: row.name,
  layout: row.layout,
  props: row.props ?? null,
  variants: row.variants ?? null,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  createdBy: row.created_by ?? null,
  updatedBy: row.updated_by ?? null,
}));

writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Exported ${payload.length} reusable block(s) → ${OUT_PATH}`);
