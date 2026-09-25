import { describe, expect, mock, test } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import { SKELETON_CONTENT_SCHEMA_VERSION, type TemplateSkeletonRecord } from "@ob-cms/template-registry";
import { digestFromSkeletonRecord } from "../template-skeleton-snapshot.util";
import { TemplateSkeletonVersionRepository } from "../template-skeleton-version.repository";

const layout = emptyLayout();
const now = new Date("2026-08-01T12:00:00.000Z");

const record: TemplateSkeletonRecord = {
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

type VersionRow = {
  id: string;
  skeletonId: string;
  templateKey: string;
  version: string;
  metadata: Record<string, unknown>;
  content: Record<string, unknown>;
  snapshotDigest: string;
  createdAt: Date;
  createdBy: string | null;
};

function versionRow(overrides: Partial<VersionRow> = {}): VersionRow {
  return {
    id: "tsv_1",
    skeletonId: "tsk_test",
    templateKey: "tpl-test",
    version: "1.4.0",
    metadata: {},
    content: {},
    snapshotDigest: digestFromSkeletonRecord(record),
    createdAt: now,
    createdBy: null,
    ...overrides,
  };
}

function createSelectChain<T>(result: T, endsAt: "limit" | "orderBy" | "where" = "limit") {
  const chain = {
    from: mock(() => chain),
    where: mock(() => (endsAt === "where" ? Promise.resolve(result) : chain)),
    orderBy: mock(() => (endsAt === "orderBy" ? Promise.resolve(result) : chain)),
    limit: mock(async () => result),
  };
  return chain;
}

function createRepository(options: {
  latestDigest?: string | null;
  rows?: VersionRow[];
  inserted?: VersionRow[];
  listMode?: boolean;
}) {
  const inserted: VersionRow[] = options.inserted ?? [];
  const rows = options.rows ?? [];
  let selectCount = 0;

  const db = {
    select: mock(() => {
      selectCount += 1;
      if (selectCount === 1 && options.latestDigest !== undefined) {
        return createSelectChain(
          options.latestDigest
            ? [{ snapshotDigest: options.latestDigest }]
            : [],
        );
      }
      return createSelectChain(rows, options.listMode ? "orderBy" : "limit");
    }),
    insert: mock(() => ({
      values: mock(async (payload: Omit<VersionRow, "id" | "createdAt">) => {
        inserted.push({
          id: `tsv_${inserted.length + 1}`,
          createdAt: now,
          ...payload,
        });
      }),
    })),
  };

  return {
    repository: new TemplateSkeletonVersionRepository(db as never),
    inserted,
  };
}

describe("TemplateSkeletonVersionRepository", () => {
  test("appendIfChanged inserts when no prior digest exists", async () => {
    const { repository, inserted } = createRepository({ latestDigest: null });
    const appended = await repository.appendIfChanged(record, "usr_admin");
    expect(appended).toBe(true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.version).toBe("1.4.0");
    expect(inserted[0]?.createdBy).toBe("usr_admin");
  });

  test("appendIfChanged skips duplicate snapshot digest", async () => {
    const digest = digestFromSkeletonRecord(record);
    const { repository, inserted } = createRepository({ latestDigest: digest });
    const appended = await repository.appendIfChanged(record, "usr_admin");
    expect(appended).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  test("appendIfChanged treats unique version conflicts as idempotent no-ops", async () => {
    const db = {
      select: mock(() => createSelectChain([], "limit")),
      insert: mock(() => ({
        values: mock(async () => {
          const err = new Error("duplicate key") as Error & { code: string };
          err.code = "23505";
          throw err;
        }),
      })),
    };

    const repository = new TemplateSkeletonVersionRepository(db as never);
    const appended = await repository.appendIfChanged(record, "usr_admin");
    expect(appended).toBe(false);
  });

  test("listBySkeletonId returns summaries newest first", async () => {
    const rows = [
      versionRow({ id: "tsv_new", version: "1.5.0", createdAt: new Date("2026-08-02T00:00:00.000Z") }),
      versionRow({ id: "tsv_old", version: "1.4.0", createdAt: new Date("2026-08-01T00:00:00.000Z") }),
    ];
    const { repository } = createRepository({ rows, listMode: true });
    const summaries = await repository.listBySkeletonId("tsk_test");
    expect(summaries).toHaveLength(2);
    expect(summaries[0]?.version).toBe("1.5.0");
    expect(summaries[1]?.version).toBe("1.4.0");
    expect(summaries[0]).not.toHaveProperty("content");
  });

  test("findBySkeletonIdAndVersion returns latest matching row", async () => {
    const rows = [versionRow({ version: "1.4.0", content: { layout } })];
    const { repository } = createRepository({ rows });
    const detail = await repository.findBySkeletonIdAndVersion("tsk_test", "1.4.0");
    expect(detail?.version).toBe("1.4.0");
    expect(detail?.content).toEqual({ layout });
  });
});
