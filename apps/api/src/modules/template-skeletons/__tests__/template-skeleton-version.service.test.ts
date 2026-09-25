import { describe, expect, mock, test } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { emptyLayout } from "@ob-cms/block-schema";
import {
  SKELETON_CONTENT_SCHEMA_VERSION,
  type TemplateSkeletonRecord,
  type TemplateSkeletonStorage,
} from "@ob-cms/template-registry";
import { TemplateSkeletonVersionService } from "../template-skeleton-version.service";
import type { TemplateSkeletonVersionRepository } from "../template-skeleton-version.repository";

const layout = emptyLayout();

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

function createService(options: {
  skeleton?: TemplateSkeletonRecord | null;
  history?: Array<{ version: string; createdAt: string }>;
  versionDetail?: { version: string; content: typeof record.content } | null;
}) {
  const storage: TemplateSkeletonStorage = {
    create: mock(async () => record),
    findById: mock(async () => options.skeleton ?? null),
    findByKey: mock(async () => options.skeleton ?? null),
    update: mock(async () => record),
    delete: mock(async () => undefined),
    list: mock(async () => []),
  };

  const versions = {
    appendIfChanged: mock(async () => true),
    listBySkeletonId: mock(async () =>
      (options.history ?? []).map((row) => ({
        skeletonId: "tsk_test",
        templateKey: "tpl-test",
        version: row.version,
        createdAt: row.createdAt,
        createdBy: null,
        metadata: record.metadata,
      })),
    ),
    findBySkeletonIdAndVersion: mock(async () =>
      options.versionDetail
        ? {
            skeletonId: "tsk_test",
            templateKey: "tpl-test",
            version: options.versionDetail.version,
            createdAt: "2026-08-01T00:00:00.000Z",
            createdBy: null,
            metadata: record.metadata,
            content: options.versionDetail.content,
          }
        : null,
    ),
    countBySkeletonId: mock(async () => 0),
  } as unknown as TemplateSkeletonVersionRepository;

  return new TemplateSkeletonVersionService(versions, storage);
}

describe("TemplateSkeletonVersionService", () => {
  test("listHistory requires existing skeleton", async () => {
    const service = createService({ skeleton: null });
    await expect(service.listHistory("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("listHistory returns repository rows newest first", async () => {
    const service = createService({
      skeleton: record,
      history: [
        { version: "1.5.0", createdAt: "2026-08-02T00:00:00.000Z" },
        { version: "1.4.0", createdAt: "2026-08-01T00:00:00.000Z" },
      ],
    });
    const rows = await service.listHistory("tsk_test");
    expect(rows.map((row) => row.version)).toEqual(["1.5.0", "1.4.0"]);
  });

  test("getVersion throws when snapshot missing", async () => {
    const service = createService({ skeleton: record, versionDetail: null });
    await expect(service.getVersion("tsk_test", "9.9.9")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("getVersion returns full snapshot content", async () => {
    const service = createService({
      skeleton: record,
      versionDetail: { version: "1.4.0", content: record.content },
    });
    const detail = await service.getVersion("tsk_test", "1.4.0");
    expect(detail.content.layout).toEqual(layout);
  });
});
