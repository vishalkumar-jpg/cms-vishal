/**
 * Replace stale reusable-block references across site chrome + pages.
 *
 * Run:
 *   bun scripts/repair-reusable-block-refs.mjs [fromId] [toId] [siteId]
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

const FROM_ID = process.argv[2] ?? "rub_1YlLQjGJoYerTYwJ5dYt9rugLLi";
const TO_ID = process.argv[3] ?? "rub_1YlOCJOzGiRomOFlgp3uWzjVolE";
const SITE_ID = process.argv[4] ?? "ste_1YTg6GBGaeEMm3U5uXEe3teEqR3";

function replaceRefs(layout, fromId, toId) {
  if (!layout || typeof layout !== "object") return layout;
  const nodes = layout.nodes;
  if (!nodes || typeof nodes !== "object") return layout;
  let changed = false;
  const nextNodes = { ...nodes };
  for (const [id, node] of Object.entries(nextNodes)) {
    if (node?.type?.resolvedName !== "Reusable Block") continue;
    if (node?.props?.reusableBlockId !== fromId) continue;
    nextNodes[id] = { ...node, props: { ...node.props, reusableBlockId: toId } };
    changed = true;
  }
  return changed ? { ...layout, nodes: nextNodes } : layout;
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: target } = await client.query(
  `SELECT id, name FROM ob_cms.reusable_blocks
   WHERE id = $1 AND site_id = $2 AND deleted_at IS NULL`,
  [TO_ID, SITE_ID],
);
if (target.length === 0) {
  console.error(`Target reusable block ${TO_ID} not found for site ${SITE_ID}`);
  process.exit(1);
}

console.log(`Replacing ${FROM_ID} → ${TO_ID} (${target[0].name}) on site ${SITE_ID}`);

const { rows: settings } = await client.query(
  `SELECT id, header_layout, footer_layout FROM ob_cms.site_settings WHERE site_id = $1`,
  [SITE_ID],
);
if (settings[0]) {
  const header = replaceRefs(settings[0].header_layout, FROM_ID, TO_ID);
  const footer = replaceRefs(settings[0].footer_layout, FROM_ID, TO_ID);
  if (
    JSON.stringify(header) !== JSON.stringify(settings[0].header_layout) ||
    JSON.stringify(footer) !== JSON.stringify(settings[0].footer_layout)
  ) {
    await client.query(
      `UPDATE ob_cms.site_settings SET header_layout = $1, footer_layout = $2, updated_at = now() WHERE id = $3`,
      [JSON.stringify(header), JSON.stringify(footer), settings[0].id],
    );
    console.log("Updated site_settings global chrome");
  }
}

const { rows: pages } = await client.query(
  `SELECT id, slug, draft_layout, published_layout FROM ob_cms.pages
   WHERE site_id = $1 AND deleted_at IS NULL
   AND (draft_layout::text LIKE $2 OR published_layout::text LIKE $2)`,
  [SITE_ID, `%${FROM_ID}%`],
);

for (const page of pages) {
  const draft = replaceRefs(page.draft_layout, FROM_ID, TO_ID);
  const published = replaceRefs(page.published_layout, FROM_ID, TO_ID);
  if (
    JSON.stringify(draft) === JSON.stringify(page.draft_layout) &&
    JSON.stringify(published) === JSON.stringify(page.published_layout)
  ) {
    continue;
  }
  await client.query(
    `UPDATE ob_cms.pages SET draft_layout = $1, published_layout = $2, updated_at = now() WHERE id = $3`,
    [JSON.stringify(draft), JSON.stringify(published), page.id],
  );
  console.log(`Updated page: ${page.slug}`);
}

await client.end();
console.log("Done.");
