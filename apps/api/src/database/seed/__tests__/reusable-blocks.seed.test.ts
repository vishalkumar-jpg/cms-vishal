import { describe, expect, test } from "bun:test";
import { deserializeLayout } from "@ob-cms/block-schema";
import {
  OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT,
  OFFICEBEACON_REUSABLE_BLOCK_SEEDS,
  seedOfficeBeaconReusableBlocks,
  type ReusableBlockSeedEntry,
} from "../reusable-blocks.seed";

/** Page layouts reference these ids — fixtures must preserve them for UAT parity. */
const PAGE_REFERENCED_IDS = [
  "rub_1YlUUuryOwmXvncgL7lbkhKktyd", // video section (ob-homepage, how-it-works)
  "rub_1Yo8lAaakU0nksuZ0v7Zd1broVQ", // numbers card2 (how-it-works)
] as const;

type StoredRow = {
  id: string;
  siteId: string;
  name: string;
  layout: ReusableBlockSeedEntry["layout"];
  props: unknown[] | null;
  variants: unknown[] | null;
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
};

describe("officebeacon reusable block fixtures", () => {
  test("exports exactly 14 blocks from local source catalog", () => {
    expect(OFFICEBEACON_REUSABLE_BLOCK_SEEDS.length).toBe(OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT);
  });

  test("includes every page-referenced rub_* id", () => {
    const ids = new Set(OFFICEBEACON_REUSABLE_BLOCK_SEEDS.map((entry) => entry.id));
    for (const id of PAGE_REFERENCED_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test("every fixture layout deserializes through block-schema", () => {
    for (const entry of OFFICEBEACON_REUSABLE_BLOCK_SEEDS) {
      expect(() => deserializeLayout(JSON.stringify(entry.layout))).not.toThrow();
    }
  });

  test("fixture ids and names are unique within the catalog", () => {
    const ids = OFFICEBEACON_REUSABLE_BLOCK_SEEDS.map((entry) => entry.id);
    const names = OFFICEBEACON_REUSABLE_BLOCK_SEEDS.map((entry) => entry.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  test("does not embed local site_id — site is resolved at seed runtime", () => {
    for (const entry of OFFICEBEACON_REUSABLE_BLOCK_SEEDS) {
      expect("siteId" in entry).toBe(false);
      expect("site_id" in entry).toBe(false);
    }
  });
});

describe("seedOfficeBeaconReusableBlocks idempotency", () => {
  test("inserts when missing and skips when active row already exists", async () => {
    const targetSiteId = "ste_target";
    const store: StoredRow[] = [];
    let pass = 0;

    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              pass += 1;
              const entryIndex = Math.floor((pass - 1) / 2);
              const entry = OFFICEBEACON_REUSABLE_BLOCK_SEEDS[entryIndex];
              if (!entry) return [];

              if (pass % 2 === 1) {
                return store.filter((row) => row.id === entry.id);
              }

              return store.filter(
                (row) =>
                  row.siteId === targetSiteId &&
                  row.name === entry.name &&
                  row.deletedAt === null,
              );
            },
          }),
        }),
      }),
      insert: () => ({
        values: async (value: StoredRow) => {
          store.push(value);
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    };

    const first = await seedOfficeBeaconReusableBlocks(db as never, targetSiteId);
    expect(first.inserted.length).toBe(OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT);
    expect(first.skipped).toHaveLength(0);

    pass = 0;
    const second = await seedOfficeBeaconReusableBlocks(db as never, targetSiteId);
    expect(second.inserted).toHaveLength(0);
    expect(second.skipped.length).toBe(OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT);
    expect(store.filter((row) => row.deletedAt === null)).toHaveLength(
      OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT,
    );
  });

  test("does not overwrite an unrelated reusable block on the target site", async () => {
    const targetSiteId = "ste_target";
    const unrelated: StoredRow = {
      id: "rub_unrelated_uat_only",
      siteId: targetSiteId,
      name: "uat-only block",
      layout: OFFICEBEACON_REUSABLE_BLOCK_SEEDS[0]!.layout,
      props: null,
      variants: null,
      deletedAt: null,
    };

    const store: StoredRow[] = [unrelated];
    let pass = 0;

    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              pass += 1;
              const entryIndex = Math.floor((pass - 1) / 2);
              const entry = OFFICEBEACON_REUSABLE_BLOCK_SEEDS[entryIndex];
              if (!entry) return [];

              if (pass % 2 === 1) {
                return store.filter((row) => row.id === entry.id);
              }

              return store.filter(
                (row) =>
                  row.siteId === targetSiteId &&
                  row.name === entry.name &&
                  row.deletedAt === null,
              );
            },
          }),
        }),
      }),
      insert: () => ({
        values: async (value: StoredRow) => {
          store.push(value);
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    };

    await seedOfficeBeaconReusableBlocks(db as never, targetSiteId);

    expect(store.some((row) => row.id === unrelated.id)).toBe(true);
    expect(store.filter((row) => row.deletedAt === null).length).toBe(
      OFFICEBEACON_REUSABLE_BLOCK_SEED_COUNT + 1,
    );
  });
});
