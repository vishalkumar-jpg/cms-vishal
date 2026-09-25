import { describe, expect, mock, test } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  TemplateCatalogStorageError,
  type TemplateCatalogEntry,
  type TemplateCatalogStorage,
} from "@ob-cms/template-registry";
import { TemplateCatalogService } from "../template-catalog.service";

const entry: TemplateCatalogEntry = {
  id: "tsk_home",
  templateKey: "tpl-homepage",
  displayName: "Homepage",
  description: "Primary marketing home",
  category: "marketing",
  supportedPageTypes: ["homepage"],
  tags: ["home"],
  version: "1.0.0",
  status: "published",
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z",
};

function createStorageMock(
  overrides: Partial<TemplateCatalogStorage> = {},
): TemplateCatalogStorage {
  return {
    list: mock(async () => []),
    getById: mock(async () => null),
    getByKey: mock(async () => null),
    ...overrides,
  };
}

function createService(storage: TemplateCatalogStorage): TemplateCatalogService {
  return new TemplateCatalogService(storage);
}

describe("TemplateCatalogService", () => {
  test("list parses query filters and delegates to storage", async () => {
    const storage = createStorageMock({
      list: mock(async () => [entry]),
    });
    const service = createService(storage);

    const rows = await service.list({ category: "marketing", status: "published" });
    expect(rows).toHaveLength(1);
    expect(storage.list).toHaveBeenCalled();
  });

  test("list rejects invalid sort before calling storage", () => {
    const storage = createStorageMock();
    const service = createService(storage);

    expect(() => service.list({ sort: "invalid" })).toThrow(BadRequestException);
    expect(storage.list).not.toHaveBeenCalled();
  });

  test("getById throws NotFoundException when missing", async () => {
    const storage = createStorageMock();
    const service = createService(storage);

    await expect(service.getById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("getByKey throws NotFoundException when missing", async () => {
    const storage = createStorageMock();
    const service = createService(storage);

    await expect(service.getByKey("tpl-missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("maps storage NOT_FOUND to NotFoundException", async () => {
    const storage = createStorageMock({
      getById: mock(async () => {
        throw new TemplateCatalogStorageError("missing", "NOT_FOUND");
      }),
    });
    const service = createService(storage);

    await expect(service.getById("tsk_missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("getById returns entry when storage finds a row", async () => {
    const storage = createStorageMock({
      getById: mock(async () => entry),
    });
    const service = createService(storage);

    const row = await service.getById("tsk_home");
    expect(row.templateKey).toBe("tpl-homepage");
  });
});
