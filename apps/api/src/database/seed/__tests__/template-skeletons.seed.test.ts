import { describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { deserializeLayout, type SerializedLayout } from "@ob-cms/block-schema";
import {
  BUILTIN_TEMPLATE_IDS,
  BUILTIN_TEMPLATE_SEEDS,
  parseTemplateCatalogEntry,
  type CreateTemplateSkeletonInput,
} from "@ob-cms/template-registry";
import {
  appendSkeletonVersionSnapshot,
  backfillSkeletonVersionIfEmpty,
} from "@modules/template-skeletons/template-skeleton-version.repository";
import { digestFromSkeletonRecord } from "@modules/template-skeletons/template-skeleton-snapshot.util";
import {
  BUILTIN_SKELETON_SEED_DEFS,
  BUILTIN_SKELETON_SEED_VERSION,
  compareSemverVersions,
  getBuiltinSkeletonSeedInputs,
  seedBuiltinTemplateSkeletonsWithStore,
  thumbnailFor,
  type SkeletonSeedStore,
} from "../template-skeletons.seed";
import { STARTER_LAYOUT_BUILDERS } from "../starter-layouts";

const PREVIEW_DIR = join(
  import.meta.dir,
  "../../../../../admin/public/templates/previews",
);

export const EXPECTED_STARTER_KEYS = [
  "tpl-blank",
  "tpl-saas-landing",
  "tpl-marketing-hero",
  "tpl-portfolio",
  "tpl-contact",
  "tpl-about",
  "tpl-landing",
  "tpl-thank-you",
  "tpl-404",
  "tpl-privacy-policy",
  "tpl-terms",
  "tpl-generic-content",
  "tpl-homepage",
  "tpl-services",
  "tpl-service-detail",
  "tpl-industry-detail",
  "tpl-pricing",
  "tpl-team",
  "tpl-careers",
  "tpl-faq",
  "tpl-features",
  "tpl-testimonials",
  "tpl-product-landing",
  "tpl-case-study",
  "tpl-blog-listing",
  "tpl-blog-detail",
  "tpl-resource-listing",
  "tpl-resource-detail",
] as const;

const SEARCH_TAGS = [
  "agency",
  "startup",
  "business",
  "company",
  "landing",
  "marketing",
  "services",
  "pricing",
  "portfolio",
  "blog",
  "resource",
  "product",
  "content",
  "documentation",
] as const;

describe("starter catalog parity", () => {
  test("seed keys match registry ids", () => {
    const seedKeys = BUILTIN_SKELETON_SEED_DEFS.map((d) => d.templateKey).sort();
    const registryIds = [...BUILTIN_TEMPLATE_IDS].sort();
    expect(seedKeys).toEqual(registryIds);
    expect(new Set(seedKeys).size).toBe(seedKeys.length);
  });

  test("every seed key has a layout builder and preview assets", () => {
    for (const key of EXPECTED_STARTER_KEYS) {
      expect(typeof STARTER_LAYOUT_BUILDERS[key]).toBe("function");
      expect(existsSync(join(PREVIEW_DIR, `${key}-thumb.svg`))).toBe(true);
      expect(existsSync(join(PREVIEW_DIR, `${key}-cover.svg`))).toBe(true);
    }
  });

  test("registry metadata mirrors seed defs", () => {
    for (const def of BUILTIN_SKELETON_SEED_DEFS) {
      const registry = BUILTIN_TEMPLATE_SEEDS.find((t) => t.id === def.templateKey);
      expect(registry).toBeDefined();
      expect(registry!.displayName).toBe(def.displayName);
      expect(registry!.description).toBe(def.description);
      expect(registry!.category).toBe(def.category);
      expect(registry!.supportedPageTypes).toEqual(def.supportedPageTypes);
      expect(registry!.tags).toEqual(def.tags);
      expect(registry!.featured).toBe(def.featured);
      expect(registry!.thumbnail).toBe(thumbnailFor(def.templateKey));
      expect(registry!.version).toBe(BUILTIN_SKELETON_SEED_VERSION);
    }
  });
});

describe("builtin template skeleton seed defs", () => {
  test("defines the deterministic starter template keys", () => {
    expect(BUILTIN_SKELETON_SEED_DEFS.map((d) => d.templateKey)).toEqual([
      ...EXPECTED_STARTER_KEYS,
    ]);
    expect(BUILTIN_SKELETON_SEED_DEFS).toHaveLength(28);
  });

  test("each def has a starter layout builder", () => {
    for (const key of EXPECTED_STARTER_KEYS) {
      expect(typeof STARTER_LAYOUT_BUILDERS[key]).toBe("function");
    }
  });

  test("each def parses as CreateTemplateSkeletonInput", () => {
    const inputs = getBuiltinSkeletonSeedInputs();
    expect(inputs).toHaveLength(EXPECTED_STARTER_KEYS.length);
    for (const input of inputs) {
      expect(input.templateKey).toMatch(/^tpl-[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(input.status).toBe("published");
      expect(input.version).toBe(BUILTIN_SKELETON_SEED_VERSION);
      expect(input.supportedPageTypes.length).toBeGreaterThan(0);
      expect(input.description.trim().length).toBeGreaterThan(0);
      expect(input.previewMetadata.thumbnail).toBe(thumbnailFor(input.templateKey));
      expect(input.content.layout).toMatchObject({
        schemaVersion: "2.0",
        root: "ROOT",
      });
    }
  });

  test("layouts are normalized and non-empty usable starters", () => {
    for (const input of getBuiltinSkeletonSeedInputs()) {
      const layout = input.content.layout as unknown as SerializedLayout;
      expect(layout).toEqual(deserializeLayout(JSON.stringify(layout)));

      const root = layout.nodes[layout.root];
      expect(root).toBeDefined();
      expect(root).toMatchObject({
        type: { resolvedName: "Section" },
        isCanvas: true,
        displayName: "Section",
        custom: {},
        hidden: false,
        parent: null,
        linkedNodes: {},
      });
      expect(root!.nodes.length).toBeGreaterThan(0);
    }
  });

  test("thumbnails are catalog-safe site-relative paths", () => {
    const inputs = getBuiltinSkeletonSeedInputs();
    for (const input of inputs) {
      const thumbnail = input.previewMetadata.thumbnail;
      expect(thumbnail).toBeDefined();
      expect(thumbnail!.startsWith("/")).toBe(true);
      expect(thumbnail!.startsWith("//")).toBe(false);
      expect(thumbnail).toMatch(/^\/templates\/previews\/tpl-[a-z0-9-]+-thumb\.svg$/);

      const entry = parseTemplateCatalogEntry({
        id: "tsk_seed_test",
        templateKey: input.templateKey,
        displayName: input.displayName,
        description: input.description,
        category: input.category,
        supportedPageTypes: input.supportedPageTypes,
        tags: input.tags,
        version: input.version,
        status: input.status,
        featured: input.previewMetadata.featured,
        thumbnail,
        createdAt: "2026-08-06T00:00:00.000Z",
        updatedAt: "2026-08-06T00:00:00.000Z",
      });
      expect(entry.thumbnail).toBe(thumbnail);
    }
  });

  test("search tags improve discoverability", () => {
    const allTags = new Set(BUILTIN_SKELETON_SEED_DEFS.flatMap((d) => d.tags));
    for (const tag of SEARCH_TAGS) {
      expect(allTags.has(tag)).toBe(true);
    }
  });

  test("featured flags are set on high-intent starters", () => {
    const featured = BUILTIN_SKELETON_SEED_DEFS.filter((d) => d.featured).map(
      (d) => d.templateKey,
    );
    expect(featured).toEqual(
      expect.arrayContaining([
        "tpl-saas-landing",
        "tpl-homepage",
        "tpl-contact",
        "tpl-service-detail",
        "tpl-product-landing",
      ]),
    );
  });
});

describe("seedBuiltinTemplateSkeletonsWithStore", () => {
  /** Bump patch segment so stored version is guaranteed newer than the seed input. */
  function bumpPatchVersion(version: string): string {
    const [major = "0", minor = "0", patch = "0"] = version.split(".");
    return `${Number(major)}.${Number(minor)}.${Number(patch) + 1}`;
  }

  /** Derive a semver strictly older than the given version. */
  function olderVersionThan(version: string): string {
    const [major = "0", minor = "0", patch = "0"] = version.split(".");
    const patchNum = Number(patch);
    if (patchNum > 0) {
      return `${Number(major)}.${Number(minor)}.${patchNum - 1}`;
    }
    const minorNum = Number(minor);
    if (minorNum > 0) {
      return `${Number(major)}.${minorNum - 1}.0`;
    }
    return "0.0.0";
  }

  /** Mirrors the pg DatabaseError shape for the active-templateKey partial unique index. */
  function templateKeyConflict(): Error {
    return Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint: "tsk_template_key_active_uidx",
    });
  }

  function createMemoryStore(
    existingKeys: Map<string, { id: string; version: string }> = new Map(),
  ): SkeletonSeedStore & {
    inserts: CreateTemplateSkeletonInput[];
    refreshes: CreateTemplateSkeletonInput[];
  } {
    const inserts: CreateTemplateSkeletonInput[] = [];
    const refreshes: CreateTemplateSkeletonInput[] = [];
    return {
      inserts,
      refreshes,
      async findActiveByKey(templateKey: string) {
        const row = existingKeys.get(templateKey);
        return row ?? null;
      },
      async insertSkeleton(input: CreateTemplateSkeletonInput) {
        if (existingKeys.has(input.templateKey)) {
          throw templateKeyConflict();
        }
        existingKeys.set(input.templateKey, {
          id: `tsk_${input.templateKey}`,
          version: input.version,
        });
        inserts.push(input);
      },
      async refreshSkeleton(id: string, input: CreateTemplateSkeletonInput) {
        const row = existingKeys.get(input.templateKey);
        if (!row || row.id !== id || compareSemverVersions(input.version, row.version) <= 0) {
          return;
        }
        existingKeys.set(input.templateKey, { id, version: input.version });
        refreshes.push(input);
      },
    };
  }

  test("inserts all starter seeds on a fresh store", async () => {
    const store = createMemoryStore();
    const result = await seedBuiltinTemplateSkeletonsWithStore(store);

    expect(result.inserted).toEqual([...EXPECTED_STARTER_KEYS]);
    expect(result.refreshed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(store.inserts.map((row) => row.templateKey)).toEqual([...EXPECTED_STARTER_KEYS]);
  });

  test("second pass skips all keys when version is unchanged", async () => {
    const store = createMemoryStore();
    const first = await seedBuiltinTemplateSkeletonsWithStore(store);
    expect(first.inserted).toHaveLength(EXPECTED_STARTER_KEYS.length);

    const second = await seedBuiltinTemplateSkeletonsWithStore(store);
    expect(second.inserted).toEqual([]);
    expect(second.refreshed).toEqual([]);
    expect(second.skipped).toEqual([...EXPECTED_STARTER_KEYS]);
    expect(store.inserts).toHaveLength(EXPECTED_STARTER_KEYS.length);
  });

  test("refreshes keys when seed version advances", async () => {
    const store = createMemoryStore(
      new Map([["tpl-blank", { id: "tsk_tpl-blank", version: "1.3.0" }]]),
    );
    const result = await seedBuiltinTemplateSkeletonsWithStore(store, {
      inputs: getBuiltinSkeletonSeedInputs().slice(0, 1),
    });

    expect(result.inserted).toEqual([]);
    expect(result.refreshed).toEqual(["tpl-blank"]);
    expect(result.skipped).toEqual([]);
    expect(store.refreshes).toHaveLength(1);
  });

  test("refreshSkeleton ignores mismatched skeleton id", async () => {
    const [seedInput] = getBuiltinSkeletonSeedInputs().slice(0, 1);
    const storedVersion = olderVersionThan(seedInput.version);
    const store = createMemoryStore(
      new Map([["tpl-blank", { id: "tsk_tpl-blank", version: storedVersion }]]),
    );

    await store.refreshSkeleton("tsk_other-id", seedInput);

    expect(store.refreshes).toEqual([]);
    expect(await store.findActiveByKey("tpl-blank")).toEqual({
      id: "tsk_tpl-blank",
      version: storedVersion,
    });
  });

  test("skips only keys that already exist at the current version", async () => {
    const store = createMemoryStore(
      new Map([
        ["tpl-blank", { id: "tsk_tpl-blank", version: BUILTIN_SKELETON_SEED_VERSION }],
        ["tpl-contact", { id: "tsk_tpl-contact", version: "1.3.0" }],
      ]),
    );
    const result = await seedBuiltinTemplateSkeletonsWithStore(store);

    expect(result.skipped).toEqual(["tpl-blank"]);
    expect(result.refreshed).toEqual(["tpl-contact"]);
    expect(result.inserted).toEqual(
      EXPECTED_STARTER_KEYS.filter((k) => k !== "tpl-blank" && k !== "tpl-contact"),
    );
  });

  test("skips refresh when stored version is newer than seed", async () => {
    const [seedInput] = getBuiltinSkeletonSeedInputs().slice(0, 1);
    const storedVersion = bumpPatchVersion(seedInput.version);
    const refreshSkeleton = mock(async () => undefined);
    const store: SkeletonSeedStore = {
      findActiveByKey: mock(async () => ({
        id: `tsk_${seedInput.templateKey}`,
        version: storedVersion,
      })),
      insertSkeleton: mock(async () => undefined),
      refreshSkeleton,
    };
    const logs: string[] = [];

    const result = await seedBuiltinTemplateSkeletonsWithStore(store, {
      inputs: [seedInput],
      log: (message) => logs.push(message),
    });

    expect(result.refreshed).toEqual([]);
    expect(result.skipped).toEqual([seedInput.templateKey]);
    expect(refreshSkeleton).not.toHaveBeenCalled();
    expect(logs).toEqual([
      `SEED :: template skeleton ${seedInput.templateKey} v${storedVersion} is newer than seed v${seedInput.version} — skipped`,
    ]);
  });

  test("skips when refresh does not apply due to concurrent version advance", async () => {
    const [seedInput] = getBuiltinSkeletonSeedInputs().slice(0, 1);
    const olderStoredVersion = olderVersionThan(seedInput.version);
    const concurrentStoredVersion = bumpPatchVersion(seedInput.version);
    const refreshSkeleton = mock(async () => undefined);
    const findActiveByKey = mock(async () => null);
    findActiveByKey
      .mockResolvedValueOnce({
        id: `tsk_${seedInput.templateKey}`,
        version: olderStoredVersion,
      })
      .mockResolvedValueOnce({
        id: `tsk_${seedInput.templateKey}`,
        version: concurrentStoredVersion,
      });
    const store: SkeletonSeedStore = {
      findActiveByKey,
      insertSkeleton: mock(async () => undefined),
      refreshSkeleton,
    };
    const logs: string[] = [];

    const result = await seedBuiltinTemplateSkeletonsWithStore(store, {
      inputs: [seedInput],
      log: (message) => logs.push(message),
    });

    expect(result.refreshed).toEqual([]);
    expect(result.skipped).toEqual([seedInput.templateKey]);
    expect(refreshSkeleton).toHaveBeenCalledTimes(1);
    expect(findActiveByKey).toHaveBeenCalledTimes(2);
    expect(logs).toEqual([
      `SEED :: template skeleton ${seedInput.templateKey} v${concurrentStoredVersion} is newer than seed v${seedInput.version} — skipped`,
    ]);
  });

  test("treats templateKey unique-violation races as skips", async () => {
    const insertSkeleton = mock(async (_input: CreateTemplateSkeletonInput) => {
      throw templateKeyConflict();
    });
    const store: SkeletonSeedStore = {
      findActiveByKey: mock(async () => null),
      insertSkeleton,
      refreshSkeleton: mock(async () => undefined),
    };

    const result = await seedBuiltinTemplateSkeletonsWithStore(store, {
      inputs: getBuiltinSkeletonSeedInputs().slice(0, 1),
    });

    expect(result.inserted).toEqual([]);
    expect(result.refreshed).toEqual([]);
    expect(result.skipped).toEqual(["tpl-blank"]);
    expect(insertSkeleton).toHaveBeenCalledTimes(1);
  });

  test("rethrows unique violations from other constraints", async () => {
    const store: SkeletonSeedStore = {
      findActiveByKey: mock(async () => null),
      insertSkeleton: mock(async () => {
        throw Object.assign(new Error("duplicate key value"), {
          code: "23505",
          constraint: "tsc_skeleton_id_uidx",
        });
      }),
      refreshSkeleton: mock(async () => undefined),
    };

    await expect(
      seedBuiltinTemplateSkeletonsWithStore(store, {
        inputs: getBuiltinSkeletonSeedInputs().slice(0, 1),
      }),
    ).rejects.toThrow("duplicate key value");
  });

  test("rethrows non-unique insert errors", async () => {
    const store: SkeletonSeedStore = {
      findActiveByKey: mock(async () => null),
      insertSkeleton: mock(async () => {
        throw new Error("connection lost");
      }),
      refreshSkeleton: mock(async () => undefined),
    };

    await expect(
      seedBuiltinTemplateSkeletonsWithStore(store, {
        inputs: getBuiltinSkeletonSeedInputs().slice(0, 1),
      }),
    ).rejects.toThrow("connection lost");
  });
});

describe("compareSemverVersions", () => {
  test("orders patch segments numerically", () => {
    expect(compareSemverVersions("1.2.10", "1.2.9")).toBe(1);
    expect(compareSemverVersions("1.2.9", "1.2.10")).toBe(-1);
  });

  test("orders minor segments numerically", () => {
    expect(compareSemverVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareSemverVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  test("returns zero for equal versions", () => {
    expect(compareSemverVersions("1.2.0", "1.2.0")).toBe(0);
  });
});

describe("template skeleton version snapshots", () => {
  const layout = deserializeLayout(JSON.stringify(getBuiltinSkeletonSeedInputs()[0]!.content.layout));
  const record = {
    metadata: {
      id: "tsk_tpl-blank",
      templateKey: "tpl-blank",
      displayName: "Blank Page",
      description: "Clean canvas",
      category: "utility" as const,
      supportedPageTypes: ["generic-content"],
      tags: ["blank"],
      previewMetadata: {},
      version: BUILTIN_SKELETON_SEED_VERSION,
      status: "published" as const,
      schemaVersion: "1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    content: {
      contentSchemaVersion: "1",
      layout,
      sections: [],
      pageStructure: {
        defaultSectionOrder: [],
        requiredSectionIds: [],
        optionalSectionIds: [],
      },
      componentProps: {},
    },
  };

  test("appendSkeletonVersionSnapshot skips unchanged digest", async () => {
    const digest = digestFromSkeletonRecord(record);
    let selectCount = 0;
    const db = {
      select: mock(() => {
        selectCount += 1;
        const chain = {
          from: mock(() => chain),
          where: mock(() => chain),
          orderBy: mock(() => chain),
          limit: mock(async () => [{ snapshotDigest: digest }]),
        };
        return chain;
      }),
      insert: mock(() => ({ values: mock(async () => undefined) })),
    };

    const appended = await appendSkeletonVersionSnapshot(db as never, record, null);
    expect(appended).toBe(false);
    expect(selectCount).toBeGreaterThan(0);
  });

  test("backfillSkeletonVersionIfEmpty only inserts when history is empty", async () => {
    let selectCount = 0;
    const db = {
      select: mock(() => {
        selectCount += 1;
        const chain = {
          from: mock(() => chain),
          where: mock(() => chain),
          orderBy: mock(() => chain),
          limit: mock(async () => []),
        };
        return chain;
      }),
      insert: mock(() => ({
        values: mock(async () => undefined),
      })),
    };

    const first = await backfillSkeletonVersionIfEmpty(db as never, record);
    expect(first).toBe(true);

    selectCount = 0;
    const insertMock = mock(() => ({ values: mock(async () => undefined) }));
    const dbWithHistory = {
      select: mock(() => {
        selectCount += 1;
        if (selectCount === 1) {
          const chain = {
            from: mock(() => chain),
            where: mock(async () => [{ id: "tsv_1" }]),
          };
          return chain;
        }
        const chain = {
          from: mock(() => chain),
          where: mock(() => chain),
          orderBy: mock(() => chain),
          limit: mock(async () => [{ snapshotDigest: digestFromSkeletonRecord(record) }]),
        };
        return chain;
      }),
      insert: insertMock,
    };

    const second = await backfillSkeletonVersionIfEmpty(dbWithHistory as never, record);
    expect(second).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
