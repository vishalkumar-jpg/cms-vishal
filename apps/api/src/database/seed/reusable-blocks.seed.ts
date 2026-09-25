/**
 * Idempotent Office Beacon reusable-block seed.
 *
 * Inserts site-scoped reusable blocks from committed fixtures so UAT (and fresh
 * local environments) resolve the same `rub_*` ids referenced by page layouts.
 *
 * Site mapping: callers resolve the target site id (typically via sites.subdomain
 * = officebeacon). Fixtures intentionally omit site_id because local/UAT site
 * UUIDs differ.
 *
 * Idempotency:
 * - Active row with same id on target site → skip
 * - Soft-deleted row with same id on target site → restore from fixture
 * - Active row with same id on a different site → skip + crossSiteConflicts
 * - Same name on target site under a different id → skip + nameConflicts
 */
import { and, eq, isNull } from "drizzle-orm";
import { deserializeLayout, type SerializedLayout } from "@ob-cms/block-schema";
import type { Database } from "@database/db";
import { reusableBlocks } from "@database/schema";
import fixture from "./fixtures/officebeacon-reusable-blocks.json";

export type ReusableBlockSeedEntry = {
  id: string;
  name: string;
  layout: SerializedLayout;
  props?: unknown[] | null;
  variants?: unknown[] | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export const OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT = 14;

export const OFFICEBEACON_REUSABLE_BLOCK_SEEDS =
  fixture as unknown as ReusableBlockSeedEntry[];

export type SeedReusableBlocksResult = {
  inserted: string[];
  restored: string[];
  skipped: string[];
  nameConflicts: string[];
  crossSiteConflicts: string[];
};

const validateLayout = (layout: SerializedLayout): SerializedLayout =>
  deserializeLayout(JSON.stringify(layout));

const rowValues = (
  entry: ReusableBlockSeedEntry,
  siteId: string,
  layout: SerializedLayout,
) =>
  ({
    id: entry.id,
    siteId,
    name: entry.name,
    layout,
    props: (entry.props ?? null) as typeof reusableBlocks.$inferInsert.props,
    variants: (entry.variants ?? null) as typeof reusableBlocks.$inferInsert.variants,
    deletedAt: null,
    createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : undefined,
    createdBy: entry.createdBy ?? null,
    updatedBy: entry.updatedBy ?? null,
  }) satisfies typeof reusableBlocks.$inferInsert;

/** Idempotent reusable-block seed for one site (typically Office Beacon). */
export async function seedOfficeBeaconReusableBlocks(
  db: Database,
  siteId: string,
  options?: { log?: (message: string) => void },
): Promise<SeedReusableBlocksResult> {
  const log = options?.log ?? (() => undefined);
  const inserted: string[] = [];
  const restored: string[] = [];
  const skipped: string[] = [];
  const nameConflicts: string[] = [];
  const crossSiteConflicts: string[] = [];

  for (const entry of OFFICEBEACON_REUSABLE_BLOCK_SEEDS) {
    const layout = validateLayout(entry.layout);

    const [byId] = await db
      .select({
        id: reusableBlocks.id,
        name: reusableBlocks.name,
        siteId: reusableBlocks.siteId,
        deletedAt: reusableBlocks.deletedAt,
      })
      .from(reusableBlocks)
      .where(eq(reusableBlocks.id, entry.id))
      .limit(1);

    if (byId) {
      if (byId.siteId !== siteId) {
        crossSiteConflicts.push(entry.id);
        log(
          `SEED :: reusable block ${entry.name} (${entry.id}) belongs to site ${byId.siteId}, not ${siteId} — skipped`,
        );
        continue;
      }

      if (!byId.deletedAt) {
        skipped.push(entry.id);
        log(`SEED :: reusable block ${entry.name} (${entry.id}) already exists — skipped`);
        continue;
      }

      await db
        .update(reusableBlocks)
        .set(rowValues(entry, siteId, layout))
        .where(eq(reusableBlocks.id, entry.id));

      restored.push(entry.id);
      log(`SEED :: restored reusable block ${entry.name} (${entry.id})`);
      continue;
    }

    const [byName] = await db
      .select({ id: reusableBlocks.id, name: reusableBlocks.name })
      .from(reusableBlocks)
      .where(
        and(
          eq(reusableBlocks.siteId, siteId),
          eq(reusableBlocks.name, entry.name),
          isNull(reusableBlocks.deletedAt),
        ),
      )
      .limit(1);

    if (byName && byName.id !== entry.id) {
      nameConflicts.push(entry.name);
      log(
        `SEED :: reusable block “${entry.name}” exists as ${byName.id}, fixture expects ${entry.id} — skipped (run repair-reusable-block-refs)`,
      );
      continue;
    }

    await db.insert(reusableBlocks).values(rowValues(entry, siteId, layout));

    inserted.push(entry.id);
    log(`SEED :: created reusable block ${entry.name} (${entry.id})`);
  }

  return { inserted, restored, skipped, nameConflicts, crossSiteConflicts };
}
