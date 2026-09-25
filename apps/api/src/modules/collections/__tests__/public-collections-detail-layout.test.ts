import { describe, expect, mock, test } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import type { CollectionItemRow, CollectionRow } from "@database/schema";
import type { Database } from "@database/db";
import type { RedisService } from "@modules/redis/redis.service";
import type { SiteResolver } from "@modules/seo/site-resolver.service";
import { PublicCollectionsService } from "../public-collections.service";

const collection = {
  id: "col_1",
  siteId: "site_test",
  name: "Case Studies",
  slug: "case-studies",
  fields: [{ key: "title", label: "Title", type: "text" }],
  detailLayout: emptyLayout(),
  deletedAt: null,
} as CollectionRow;

const item = {
  id: "cit_1",
  siteId: "site_test",
  collectionId: "col_1",
  slug: "acme",
  data: { title: "Acme" },
  status: "published",
  publishedAt: new Date("2026-08-03T00:00:00.000Z"),
  deletedAt: null,
} as CollectionItemRow;

function setup() {
  let selectIdx = 0;
  // listItems: requireCollection → collection; items query → [item]
  // getItem: requireCollection → collection; item query → [item]
  const selectQueue: unknown[][] = [[collection], [item], [collection], [item]];

  const chain = (rows: unknown[]) => {
    const self = {
      where: () => self,
      orderBy: () => self,
      limit: async (n: number) => rows.slice(0, n),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return self;
  };

  const db = {
    select: mock(() => ({
      from: mock(() => {
        const rows = selectQueue[selectIdx] ?? [];
        selectIdx += 1;
        return chain(rows);
      }),
    })),
  };

  const service = new PublicCollectionsService(
    db as unknown as Database,
    { resolve: mock(async () => ({ id: "site_test" })) } as unknown as SiteResolver,
    {
      get: mock(async () => null),
      set: mock(async () => undefined),
    } as unknown as RedisService,
  );

  return { service };
}

describe("PublicCollectionsService detailLayout exposure", () => {
  test("listItems omits detailLayout from collection meta", async () => {
    const { service } = setup();
    const result = await service.listItems("example.test", "case-studies", { limit: 10 });
    expect(result.collection).toEqual({
      slug: "case-studies",
      name: "Case Studies",
      fields: collection.fields,
    });
    expect(result.collection).not.toHaveProperty("detailLayout");
    expect(result.items).toHaveLength(1);
  });

  test("getItem includes detailLayout on collection summary", async () => {
    const { service } = setup();
    const result = await service.getItem("example.test", "case-studies", "acme");
    expect(result.collection.detailLayout).toBeTruthy();
    expect(result.collection.detailLayout?.root).toBe("ROOT");
    expect(result.item.slug).toBe("acme");
  });
});
