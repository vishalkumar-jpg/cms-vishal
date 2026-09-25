/**
 * Repair reusable-block layouts saved with root="ROOT" but no ROOT node.
 *
 * Run: bun scripts/repair-reusable-block-layouts.mjs [siteId]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
const { migrate, layoutHasContent } = require("@ob-cms/block-schema");

const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
const SITE_ID = args[0] ?? "ste_1YTg6GBGaeEMm3U5uXEe3teEqR3";
const DRY_RUN = process.argv.includes("--dry-run");

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, layout
   FROM ob_cms.reusable_blocks
   WHERE site_id = $1 AND deleted_at IS NULL`,
  [SITE_ID],
);

let repairedCount = 0;
for (const row of rows) {
  const before = row.layout;
  const after = migrate(before);
  if (JSON.stringify(before) === JSON.stringify(after)) continue;
  if (!layoutHasContent(after)) {
    console.warn(`Skip ${row.name} (${row.id}) — still empty after repair`);
    continue;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] Would repair ${row.name} (${row.id}) → root ${after.root}`);
    repairedCount++;
    continue;
  }
  await client.query(
    `UPDATE ob_cms.reusable_blocks SET layout = $1, updated_at = now() WHERE id = $2`,
    [JSON.stringify(after), row.id],
  );
  console.log(`Repaired ${row.name} (${row.id}) → root ${after.root}`);
  repairedCount++;
}

await client.end();
console.log(`Done. Repaired ${repairedCount} reusable block(s).`);
