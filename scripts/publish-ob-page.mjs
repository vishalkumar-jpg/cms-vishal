/**
 * Publish a builder layout JSON to a site page (creates page if missing).
 *
 * Run:
 *   bun scripts/publish-ob-page.mjs
 *
 * Env:
 *   OB_PAGE_SLUG       — page slug (default: how-it-works)
 *   OB_PAGE_TITLE      — title when creating (default: How It Works)
 *   OB_LAYOUT_PATH     — path to layout JSON
 *   OB_SITE_SUBDOMAIN  — site subdomain (default: officebeacon)
 *   DATABASE_URL       — postgres connection string
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../apps/api/package.json"));
const { Client } = require("pg");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_SLUG = process.env.OB_PAGE_SLUG ?? "how-it-works";
const PAGE_TITLE = process.env.OB_PAGE_TITLE ?? "How It Works";
const SITE_SUBDOMAIN = process.env.OB_SITE_SUBDOMAIN ?? "officebeacon";
const SEO_META = {
  title: "How OfficeBeacon Remote Staffing & Virtual Assistant Works",
  description:
    "Discover how virtual assistant & remote staffing services work. From hiring to scaling, Office Beacon makes outsourcing easy—contact us today!",
};
const seoPayload = (slug) =>
  JSON.stringify({ ...SEO_META, canonical: `/${slug}` });
const LAYOUT_PATH =
  process.env.OB_LAYOUT_PATH ??
  join(ROOT, "apps/admin/src/views/builder/sections/obHowItWorks.json");

const layout = JSON.parse(readFileSync(LAYOUT_PATH, "utf8"));
const layoutJson = JSON.stringify(layout);

const client = new Client({
  connectionString: process.env.DATABASE_URL ?? "postgresql://obcms:obcms@localhost:5432/obcms",
});
await client.connect();

const { rows: siteRows } = await client.query(
  `SELECT id, subdomain FROM ob_cms.sites WHERE subdomain = $1 AND deleted_at IS NULL LIMIT 1`,
  [SITE_SUBDOMAIN],
);
if (!siteRows.length) {
  console.error(`Site not found: ${SITE_SUBDOMAIN}`);
  process.exit(1);
}
const site = siteRows[0];

let { rows: pageRows } = await client.query(
  `SELECT id, slug, title FROM ob_cms.pages
    WHERE site_id = $1 AND slug = $2 AND locale = 'en' AND deleted_at IS NULL
    LIMIT 1`,
  [site.id, PAGE_SLUG],
);

if (!pageRows.length) {
  const pageId = `pag_${randomBytes(12).toString("hex")}`;
  await client.query(
    `INSERT INTO ob_cms.pages (
       id, site_id, title, slug, locale, translation_key,
       status, workflow_state, draft_layout, published_layout,
       seo, schema_version, published_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, 'en', $1,
       'published', 'published', $5::jsonb, $5::jsonb,
       $6::jsonb, '2.0', NOW(), NOW(), NOW()
     )`,
    [
      pageId,
      site.id,
      PAGE_TITLE,
      PAGE_SLUG,
      layoutJson,
      seoPayload(PAGE_SLUG),
    ],
  );
  ({ rows: pageRows } = await client.query(
    `SELECT id, slug, title FROM ob_cms.pages WHERE id = $1`,
    [pageId],
  ));
  console.log(`Created page "${PAGE_TITLE}" (slug=${PAGE_SLUG})`);
}

const page = pageRows[0];
const { rowCount } = await client.query(
  `UPDATE ob_cms.pages
      SET draft_layout = $1::jsonb,
          published_layout = $1::jsonb,
          status = 'published',
          workflow_state = 'published',
          published_at = COALESCE(published_at, NOW()),
          updated_at = NOW(),
          seo = COALESCE(seo, '{}'::jsonb) || $3::jsonb
    WHERE id = $2`,
  [
    layoutJson,
    page.id,
    seoPayload(PAGE_SLUG),
  ],
);

console.log(`Updated page "${page.title}" (${page.id}, slug=${page.slug})`);
console.log(`  site: ${site.subdomain}`);
console.log(`  public path: /${PAGE_SLUG}`);
console.log(`  nodes in layout: ${Object.keys(layout.nodes ?? {}).length}`);
console.log(`  rows updated: ${rowCount}`);

await client.end();
