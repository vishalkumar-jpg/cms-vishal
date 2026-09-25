import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { initKsuid } from "@utils/ksuid.utils";
import { db, pool } from "../db";
import { sites } from "../schema";
import {
  OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT,
  seedOfficeBeaconReusableBlocks,
} from "./reusable-blocks.seed";

config();

/**
 * Seed only Office Beacon reusable blocks (safe for UAT — no user/org changes).
 *
 * Resolves the target site by subdomain (default officebeacon), not by local UUID.
 *
 * Run: bun run db:seed:reusable-blocks
 */
async function main(): Promise<void> {
  await initKsuid();

  const subdomain = process.env.OB_SITE_SUBDOMAIN ?? "officebeacon";
  const [site] = await db.select().from(sites).where(eq(sites.subdomain, subdomain)).limit(1);
  if (!site) {
    console.error(`SEED :: site subdomain=${subdomain} not found`);
    process.exit(1);
  }

  const result = await seedOfficeBeaconReusableBlocks(db, site.id, {
    log: (message) => {
      // eslint-disable-next-line no-console
      console.log(message);
    },
  });

  const materialized =
    result.inserted.length + result.restored.length + result.skipped.length;

  // eslint-disable-next-line no-console
  console.log(
    `\nSEED :: reusable blocks complete — site=${site.subdomain} (${site.id})`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `       inserted=${result.inserted.length}, restored=${result.restored.length}, skipped=${result.skipped.length}, nameConflicts=${result.nameConflicts.length}, crossSiteConflicts=${result.crossSiteConflicts.length}, fixture=${OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT}, materialized=${materialized}`,
  );

  if (result.nameConflicts.length > 0 || result.crossSiteConflicts.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "SEED :: conflicts detected — page refs may remain unresolved. For name/id mismatches run scripts/repair-reusable-block-refs.mjs.",
    );
    process.exit(2);
  }

  if (materialized !== OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT) {
    // eslint-disable-next-line no-console
    console.warn(
      `SEED :: expected ${OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT} fixture blocks materialized on site, got ${materialized}`,
    );
    process.exit(3);
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("SEED :: reusable blocks failed", error);
    await pool.end();
    process.exit(1);
  });
