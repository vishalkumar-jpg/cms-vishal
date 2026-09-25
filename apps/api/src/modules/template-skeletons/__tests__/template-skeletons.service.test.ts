import { describe, expect, mock, test } from "bun:test";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { emptyLayout } from "@ob-cms/block-schema";
import {
  SKELETON_CONTENT_SCHEMA_VERSION,
  TemplateSkeletonStorageError,
  type TemplateSkeletonRecord,
  type TemplateSkeletonStorage,
} from "@ob-cms/template-registry";
import { TemplateSkeletonsService } from "../template-skeletons.service";
import type { TemplateSkeletonVersionService } from "../template-skeleton-version.service";

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
    version: "1.0.0",
    status: "draft",
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

const actor = { userId: "usr_test", email: "admin@test.com", roles: [] };

function createStorageMock(overrides: Partial<TemplateSkeletonStorage> = {}): TemplateSkeletonStorage {
  return {
    create: mock(async () => record),
    findById: mock(async () => null),
    findByKey: mock(async () => null),
    update: mock(async () => record),
    delete: mock(async () => undefined),
    list: mock(async () => []),
    ...overrides,
  };
}

function createVersionsMock(): TemplateSkeletonVersionService {
  return {
    appendIfChanged: mock(async () => true),
    listHistory: mock(async () => []),
    getVersion: mock(async () => {
      throw new Error("not implemented");
    }),
  } as unknown as TemplateSkeletonVersionService;
}

function createService(storage: TemplateSkeletonStorage): TemplateSkeletonsService {
  return new TemplateSkeletonsService(storage, createVersionsMock());
}

describe("TemplateSkeletonsService", () => {
  test("create validates layout and delegates to storage", async () => {
    const storage = createStorageMock();
    const service = createService(storage);

    const result = await service.create(
      {
        templateKey: "tpl-test",
        displayName: "Test",
        description: "Desc",
        category: "marketing",
        supportedPageTypes: ["landing"],
        version: "1.0.0",
        content: { layout },
      },
      actor,
    );

    expect(result.metadata.templateKey).toBe("tpl-test");
    expect(storage.create).toHaveBeenCalled();
  });

  test("create rejects invalid template key at validation layer", async () => {
    const storage = createStorageMock();
    const service = createService(storage);

    await expect(
      service.create(
        {
          templateKey: "not-a-valid-key",
          displayName: "Test",
          description: "Desc",
          category: "marketing",
          supportedPageTypes: ["landing"],
          version: "1.0.0",
          content: { layout },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.create).not.toHaveBeenCalled();
  });

  test("create rejects invalid layout", async () => {
    const storage = createStorageMock();
    const service = createService(storage);
    const circularLayout: Record<string, unknown> = { root: "ROOT" };
    circularLayout.self = circularLayout;

    await expect(
      service.create(
        {
          templateKey: "tpl-test",
          displayName: "Test",
          description: "Desc",
          category: "marketing",
          supportedPageTypes: ["landing"],
          version: "1.0.0",
          content: { layout: circularLayout },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.create).not.toHaveBeenCalled();
  });

  test("maps duplicate key to ConflictException", async () => {
    const storage = createStorageMock({
      create: mock(async () => {
        throw new TemplateSkeletonStorageError("duplicate", "DUPLICATE_KEY");
      }),
    });
    const service = createService(storage);

    await expect(
      service.create(
        {
          templateKey: "tpl-test",
          displayName: "Test",
          description: "Desc",
          category: "marketing",
          supportedPageTypes: ["landing"],
          version: "1.0.0",
          content: { layout },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test("getById throws NotFoundException when missing", async () => {
    const storage = createStorageMock();
    const service = createService(storage);

    await expect(service.getById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("update rejects empty patch at validation layer", async () => {
    const storage = createStorageMock({
      findById: mock(async () => record),
      findByKey: mock(async () => record),
    });
    const service = createService(storage);

    await expect(service.update("tsk_test", {}, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(storage.update).not.toHaveBeenCalled();
  });

  test("create persists version snapshot atomically via storage", async () => {
    const storage = createStorageMock();
    const versions = createVersionsMock();
    const service = new TemplateSkeletonsService(storage, versions);

    await service.create(
      {
        templateKey: "tpl-test",
        displayName: "Test",
        description: "Desc",
        category: "marketing",
        supportedPageTypes: ["landing"],
        version: "1.0.0",
        content: { layout },
      },
      actor,
    );

    expect(storage.create).toHaveBeenCalled();
    expect(versions.appendIfChanged).not.toHaveBeenCalled();
  });

  test("update persists version snapshot atomically via storage", async () => {
    const storage = createStorageMock({
      findById: mock(async () => record),
      findByKey: mock(async () => record),
    });
    const versions = createVersionsMock();
    const service = new TemplateSkeletonsService(storage, versions);

    await service.update("tsk_test", { metadata: { displayName: "Updated" } }, actor);

    expect(storage.update).toHaveBeenCalled();
    expect(versions.appendIfChanged).not.toHaveBeenCalled();
  });

  test("list parses query filters", async () => {
    const storage = createStorageMock({
      findById: mock(async () => record),
      findByKey: mock(async () => record),
      list: mock(async () => [record]),
    });
    const service = createService(storage);

    const rows = await service.list({ category: "marketing", status: "draft" });
    expect(rows).toHaveLength(1);
    expect(storage.list).toHaveBeenCalled();
  });
});
