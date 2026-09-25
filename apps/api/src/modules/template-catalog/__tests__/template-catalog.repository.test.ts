import { describe, expect, mock, test } from "bun:test";
import type {
  TemplateSkeletonAssetRow,
  TemplateSkeletonRow,
} from "@database/schema/template-skeletons.schema";
import { TemplateCatalogRepository } from "../template-catalog.repository";

const now = new Date("2026-07-30T12:00:00.000Z");

function skeletonRow(overrides: Partial<TemplateSkeletonRow> = {}): TemplateSkeletonRow {
  return {
    id: "tsk_home",
    templateKey: "tpl-homepage",
    displayName: "Homepage",
    description: "Primary marketing home",
    category: "marketing",
    tags: ["home"],
    supportedPageTypes: ["homepage"],
    previewMetadata: {},
    version: "1.0.0",
    status: "published",
    schemaVersion: "1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function assetRow(overrides: Partial<TemplateSkeletonAssetRow> = {}): TemplateSkeletonAssetRow {
  return {
    id: "tsa_thumb",
    skeletonId: "tsk_home",
    assetType: "thumbnail",
    storageKey: null,
    url: "https://cdn.example.com/thumb.png",
    mimeType: "image/png",
    width: null,
    height: null,
    size: null,
    altText: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

type DbMock = {
  select: ReturnType<typeof mock>;
};

function createSelectChain<T>(result: T, endsAt: "limit" | "orderBy" | "where" = "limit") {
  const chain = {
    from: mock(() => chain),
    where: mock(() => (endsAt === "where" ? Promise.resolve(result) : chain)),
    orderBy: mock(() => (endsAt === "orderBy" ? Promise.resolve(result) : chain)),
    limit: mock(async () => result),
  };
  return chain;
}

function createDbMock(config: {
  skeletonList?: TemplateSkeletonRow[];
  skeletonSingle?: TemplateSkeletonRow | null;
  includeAssets?: boolean;
  thumbnailAssets?: TemplateSkeletonAssetRow[];
  allAssets?: TemplateSkeletonAssetRow[];
}): DbMock {
  let selectCount = 0;

  return {
    select: mock(() => {
      selectCount += 1;

      if (selectCount === 1) {
        if (config.skeletonList !== undefined) {
          return createSelectChain(config.skeletonList, "limit");
        }
        return createSelectChain(config.skeletonSingle ? [config.skeletonSingle] : [], "limit");
      }

      if (config.skeletonList !== undefined) {
        if (selectCount === 2) {
          if (config.includeAssets) {
            return createSelectChain(config.allAssets ?? [], "orderBy");
          }
          return createSelectChain(config.thumbnailAssets ?? [], "where");
        }
        return createSelectChain([], "orderBy");
      }

      return createSelectChain(
        config.thumbnailAssets ? [config.thumbnailAssets[0] ?? null].filter(Boolean) : [],
        "limit",
      );
    }),
  };
}

function createRepository(db: DbMock): TemplateCatalogRepository {
  return new TemplateCatalogRepository(db as never);
}

describe("TemplateCatalogRepository", () => {
  test("list returns mapped entries", async () => {
    const db = createDbMock({ skeletonList: [skeletonRow()], thumbnailAssets: [] });
    const repository = createRepository(db);

    const rows = await repository.list({ includeAssets: false, sort: "displayName" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.templateKey).toBe("tpl-homepage");
  });

  test("list omits previewAssets when includeAssets is false", async () => {
    const db = createDbMock({
      skeletonList: [skeletonRow()],
      thumbnailAssets: [assetRow()],
    });
    const repository = createRepository(db);

    const rows = await repository.list({ includeAssets: false, sort: "displayName" });
    expect(rows[0]?.previewAssets).toBeUndefined();
    expect(rows[0]?.thumbnail).toBe("https://cdn.example.com/thumb.png");
  });

  test("list includes previewAssets when includeAssets is true", async () => {
    const db = createDbMock({
      skeletonList: [skeletonRow()],
      includeAssets: true,
      allAssets: [assetRow(), assetRow({ id: "tsa_gallery", assetType: "gallery_image" })],
    });
    const repository = createRepository(db);

    const rows = await repository.list({ includeAssets: true, sort: "displayName" });
    expect(rows[0]?.previewAssets).toHaveLength(2);
  });

  test("list returns empty array when no skeleton rows match", async () => {
    const db = createDbMock({ skeletonList: [] });
    const repository = createRepository(db);

    const rows = await repository.list({ includeAssets: false, sort: "displayName" });
    expect(rows).toEqual([]);
  });

  test("getById returns mapped entry", async () => {
    const db = createDbMock({
      skeletonSingle: skeletonRow(),
      thumbnailAssets: [assetRow()],
    });
    const repository = createRepository(db);

    const row = await repository.getById("tsk_home");
    expect(row?.id).toBe("tsk_home");
    expect(row?.thumbnail).toBe("https://cdn.example.com/thumb.png");
  });

  test("getById returns null when skeleton is missing", async () => {
    const db = createDbMock({ skeletonSingle: null, thumbnailAssets: [] });
    const repository = createRepository(db);

    expect(await repository.getById("missing")).toBeNull();
  });

  test("getByKey returns mapped entry", async () => {
    const db = createDbMock({
      skeletonSingle: skeletonRow(),
      thumbnailAssets: [],
    });
    const repository = createRepository(db);

    const row = await repository.getByKey("tpl-homepage");
    expect(row?.templateKey).toBe("tpl-homepage");
  });

  test("getByKey returns null when skeleton is missing", async () => {
    const db = createDbMock({ skeletonSingle: null, thumbnailAssets: [] });
    const repository = createRepository(db);

    expect(await repository.getByKey("tpl-missing")).toBeNull();
  });
});
