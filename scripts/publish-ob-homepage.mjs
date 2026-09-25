/**
 * Push the regenerated obHomepage.json layout into the Office Beacon site's
 * published homepage (draft + published). Idempotent — safe to re-run after
 * `bun scripts/build-ob-homepage.mjs`.
 *
 * Run: bun scripts/publish-ob-homepage.mjs
 * Env: DATABASE_URL (defaults to local postgres on :5432)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../apps/api/package.json"));
const { Client } = require("pg");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAYOUT_PATH = join(ROOT, "apps/admin/src/views/builder/sections/obHomepage.json");
const PAGE_SLUG = process.env.OB_HOME_SLUG ?? "ob-homepage";
const SITE_SUBDOMAIN = process.env.OB_SITE_SUBDOMAIN ?? "officebeacon";

const layout = JSON.parse(readFileSync(LAYOUT_PATH, "utf8"));
const client = new Client({
  connectionString: process.env.DATABASE_URL ?? "postgresql://obcms:obcms@localhost:5432/obcms",
});

await client.connect();

const { rows } = await client.query(
  `SELECT p.id, p.slug, p.title, s.subdomain
     FROM ob_cms.pages p
     JOIN ob_cms.sites s ON s.id = p.site_id
    WHERE p.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND s.subdomain = $1
      AND p.slug = $2
    LIMIT 1`,
  [SITE_SUBDOMAIN, PAGE_SLUG],
);

if (!rows.length) {
  console.error(`No page found for site=${SITE_SUBDOMAIN} slug=${PAGE_SLUG}`);
  process.exit(1);
}

const page = rows[0];
const layoutJson = JSON.stringify(layout);

const { rowCount } = await client.query(
  `UPDATE ob_cms.pages
      SET draft_layout = $1::jsonb,
          published_layout = $1::jsonb,
          status = 'published',
          workflow_state = 'published',
          published_at = NOW(),
          updated_at = NOW()
    WHERE id = $2`,
  [layoutJson, page.id],
);

console.log(`Updated page "${page.title}" (${page.id}, slug=${page.slug})`);
console.log(`  site: ${page.subdomain}`);
console.log(`  nodes in layout: ${Object.keys(layout.nodes ?? {}).length}`);
console.log(`  rows updated: ${rowCount}`);

await client.end();
