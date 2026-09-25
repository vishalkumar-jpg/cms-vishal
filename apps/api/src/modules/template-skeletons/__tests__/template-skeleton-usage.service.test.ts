import { describe, expect, mock, test } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { emptyLayout } from "@ob-cms/block-schema";
import {
  SKELETON_CONTENT_SCHEMA_VERSION,
  type TemplateSkeletonRecord,
  type TemplateSkeletonStorage,
} from "@ob-cms/template-registry";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import { TemplateSkeletonUsageService } from "../template-skeleton-usage.service";

const layout = emptyLayout();
const now = new Date("2026-08-03T12:00:00.000Z");

const skeleton: TemplateSkeletonRecord = {
  metadata: {
    id: "tsk_test",
    templateKey: "tpl-test",
    displayName: "Test",
    description: "Desc",
    category: "marketing",
    supportedPageTypes: ["landing"],
    tags: [],
    previewMetadata: {},
    version: "1.4.0",
    status: "published",
    schemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  content: {
    contentSchemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
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

type MockTimestamp = Date | string | null;

type SelectChain = {
  from: ReturnType<typeof mock>;
  where: ReturnType<typeof mock>;
  groupBy: ReturnType<typeof mock>;
  orderBy: ReturnType<typeof mock>;
  limit: ReturnType<typeof mock>;
};

function createSelectChain<T>(
  result: T,
  mode: "aggregate" | "group" | "list" | "top" = "aggregate",
) {
  const chain = {
    from: mock(() => chain),
    where: mock(() => (mode === "aggregate" ? Promise.resolve(result) : chain)),
    groupBy: mock(() => chain),
    orderBy: mock(() => (mode === "group" ? Promise.resolve(result) : chain)),
    limit: mock(async () => result),
  };
  return chain;
}

function createService(options: {
  skeleton?: TemplateSkeletonRecord | null;
  totals?: { totalPages: number; lastUsedAt: MockTimestamp };
  byVersion?: Array<{ version: string; count: number }>;
  pages?: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    sourceTemplateVersion: string;
    instantiatedAt: Date;
  }>;
  top?: Array<{
    skeletonId: string | null;
    templateKey: string;
    totalPages: number;
    lastUsedAt: MockTimestamp;
  }>;
  mode?: "usage" | "top";
}) {
  let selectCount = 0;
  const storage: TemplateSkeletonStorage = {
    create: mock(async () => skeleton),
    findById: mock(async () => options.skeleton ?? null),
    findByKey: mock(async () => options.skeleton ?? null),
    update: mock(async () => skeleton),
    delete: mock(async () => undefined),
    list: mock(async () => []),
  };

  const repo = {
    db: {
      select: mock(() => {
        if (options.mode === "top") {
          return createSelectChain(options.top ?? [], "top");
        }
        selectCount += 1;
        if (selectCount === 1) {
          return createSelectChain(
            [
              {
                totalPages: options.totals?.totalPages ?? 0,
                lastUsedAt: options.totals?.lastUsedAt ?? null,
              },
            ],
            "aggregate",
          );
        }
        if (selectCount === 2) {
          return createSelectChain(options.byVersion ?? [], "group");
        }
        return createSelectChain(options.pages ?? [], "list");
      }),
    },
    scope: mock(() => ({ type: "scope" })),
  } as unknown as ScopedRepository;

  return new TemplateSkeletonUsageService(repo, storage);
}

describe("TemplateSkeletonUsageService", () => {
  test("getUsageBySkeletonId throws when skeleton missing", async () => {
    const service = createService({ skeleton: null });
    await expect(service.getUsageBySkeletonId("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("getUsageBySkeletonId returns empty usage", async () => {
    const service = createService({ skeleton, totals: { totalPages: 0, lastUsedAt: null } });
    const usage = await service.getUsageBySkeletonId("tsk_test");
    expect(usage.totalPages).toBe(0);
    expect(usage.lastUsedAt).toBeNull();
    expect(usage.pages).toEqual([]);
    expect(usage.currentVersion).toBe("1.4.0");
    expect(usage.latestVersion).toBe("1.4.0");
  });

   test("getUsageBySkeletonId returns totals, version breakdown, and pages", async () => {
    const service = createService({
      skeleton,
      totals: { totalPages: 3, lastUsedAt: now },
      byVersion: [
        { version: "1.4.0", count: 2 },
        { version: "1.3.0", count: 1 },
      ],
      pages: [
        {
          id: "pg_1",
          title: "Home",
          slug: "home",
          status: "published",
          sourceTemplateVersion: "1.4.0",
          instantiatedAt: now,
        },
      ],
    });

    const usage = await service.getUsageBySkeletonId("tsk_test");
    expect(usage.totalPages).toBe(3);
    expect(usage.lastUsedAt).toBe(now.toISOString());
    expect(usage.byVersion).toEqual([
      { version: "1.4.0", count: 2 },
      { version: "1.3.0", count: 1 },
    ]);
    expect(usage.pages[0]?.title).toBe("Home");
  });

  test("getUsageBySkeletonId handles lastUsedAt as string from PostgreSQL MAX()", async () => {
    const service = createService({
      skeleton,
      totals: { totalPages: 3, lastUsedAt: now.toISOString() },
      byVersion: [{ version: "1.4.0", count: 2 }],
      pages: [],
    });

    const usage = await service.getUsageBySkeletonId("tsk_test");
    expect(usage.totalPages).toBe(3);
    expect(usage.lastUsedAt).toBe(now.toISOString());
  });

   test("getTopTemplates returns grouped entries ordered by count", async () => {
    const service = createService({
      mode: "top",
      top: [
        {
          skeletonId: "tsk_a",
          templateKey: "tpl-a",
          totalPages: 18,
          lastUsedAt: now,
        },
        {
          skeletonId: "tsk_b",
          templateKey: "tpl-b",
          totalPages: 4,
          lastUsedAt: now,
        },
      ],
    });

    const rows = await service.getTopTemplates(10);
    expect(rows).toEqual([
      {
        skeletonId: "tsk_a",
        templateKey: "tpl-a",
        totalPages: 18,
        lastUsedAt: now.toISOString(),
      },
      {
        skeletonId: "tsk_b",
        templateKey: "tpl-b",
        totalPages: 4,
        lastUsedAt: now.toISOString(),
      },
    ]);
  });

  test("getTopTemplates handles lastUsedAt returned as string from PostgreSQL MAX()", async () => {
    const service = createService({
      mode: "top",
      top: [
        {
          skeletonId: "tsk_a",
          templateKey: "tpl-a",
          totalPages: 18,
          lastUsedAt: now.toISOString(),
        },
        {
          skeletonId: "tsk_b",
          templateKey: "tpl-b",
          totalPages: 4,
          lastUsedAt: null,
        },
      ],
    });

    const rows = await service.getTopTemplates(10);
    expect(rows).toEqual([
      {
        skeletonId: "tsk_a",
        templateKey: "tpl-a",
        totalPages: 18,
        lastUsedAt: now.toISOString(),
      },
      {
        skeletonId: "tsk_b",
        templateKey: "tpl-b",
        totalPages: 4,
        lastUsedAt: null,
      },
    ]);
  });

  test("getUsageBySkeletonId scopes queries to active site pages", async () => {
    const service = createService({
      skeleton,
      totals: { totalPages: 1, lastUsedAt: now },
    });
    await service.getUsageBySkeletonId("tsk_test");
    const repo = (service as unknown as { repo: ScopedRepository }).repo;
    expect(repo.scope).toHaveBeenCalled();
  });

  test("getUsageBySkeletonId merges null sourceTemplateVersion into latestVersion", async () => {
    const service = createService({
      skeleton,
      totals: { totalPages: 2, lastUsedAt: now },
      byVersion: [
        { version: "1.4.0", count: 1 },
        { version: null as unknown as string, count: 1 },
      ],
    });

    const usage = await service.getUsageBySkeletonId("tsk_test");
    expect(usage.byVersion).toEqual([{ version: "1.4.0", count: 2 }]);
    expect(usage.byVersion.reduce((sum, row) => sum + row.count, 0)).toBe(usage.totalPages);
  });

  test("getTopTemplates caps limit between 1 and 100", async () => {
    const topChain = {
      from: mock(() => topChain),
      where: mock(() => topChain),
      groupBy: mock(() => topChain),
      orderBy: mock(() => topChain),
      limit: mock(async () => []),
    };
    const limitMock = topChain.limit;

    const repo = {
      db: {
        select: mock(() => topChain),
      },
      scope: mock(() => ({ type: "scope" })),
    } as unknown as ScopedRepository;

    const storage: TemplateSkeletonStorage = {
      create: mock(async () => skeleton),
      findById: mock(async () => skeleton),
      findByKey: mock(async () => skeleton),
      update: mock(async () => skeleton),
      delete: mock(async () => undefined),
      list: mock(async () => []),
    };

    const service = new TemplateSkeletonUsageService(repo, storage);
    await service.getTopTemplates(500);
    await service.getTopTemplates(0);
    expect(limitMock).toHaveBeenCalledWith(100);
    expect(limitMock).toHaveBeenCalledWith(1);
  });
});
