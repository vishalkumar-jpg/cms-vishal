import { describe, expect, mock, test } from "bun:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  TemplateSkeletonAssetStorageError,
  type TemplateSkeletonAssetRecord,
  type TemplateSkeletonAssetStorage,
} from "@ob-cms/template-registry";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { TemplateSkeletonAssetsService } from "../template-skeleton-assets.service";

const actor: AuthUser = { userId: "usr_admin", email: "admin@test.com", roles: [] };

const asset: TemplateSkeletonAssetRecord = {
  id: "tsa_asset",
  skeletonId: "tsk_skeleton",
  assetType: "thumbnail",
  storageKey: null,
  url: "https://cdn.example.com/thumb.webp",
  mimeType: "image/webp",
  width: 400,
  height: 300,
  size: 1000,
  altText: "Thumb",
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createService(deps: {
  storage?: Partial<TemplateSkeletonAssetStorage>;
  skeletonExists?: boolean;
}) {
  const storage: TemplateSkeletonAssetStorage = {
    create: mock(async () => asset),
    findById: mock(async () => asset),
    listBySkeleton: mock(async () => [asset]),
    update: mock(async () => ({ ...asset, altText: "Updated" })),
    delete: mock(async () => undefined),
    ...deps.storage,
  };

  const skeletons = {
    getById: mock(async () => {
      if (deps.skeletonExists === false) throw new NotFoundException("Template skeleton not found");
      return { metadata: { id: "tsk_skeleton" } };
    }),
  };

  return {
    service: new TemplateSkeletonAssetsService(storage, skeletons as never),
    storage,
  };
}

describe("TemplateSkeletonAssetsService", () => {
  test("list returns assets when skeleton exists", async () => {
    const { service, storage } = createService({});
    const rows = await service.list("tsk_skeleton");
    expect(rows).toHaveLength(1);
    expect(storage.listBySkeleton).toHaveBeenCalledWith("tsk_skeleton");
  });

  test("list fails when skeleton missing", async () => {
    const { service } = createService({ skeletonExists: false });
    await expect(service.list("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("create validates and delegates to storage", async () => {
    const { service, storage } = createService({});
    const row = await service.create(
      "tsk_skeleton",
      { assetType: "thumbnail", url: "https://cdn.example.com/t.webp", mimeType: "image/webp" },
      actor,
    );
    expect(row.id).toBe("tsa_asset");
    expect(storage.create).toHaveBeenCalled();
  });

  test("create rejects invalid url", async () => {
    const { service } = createService({});
    await expect(
      service.create("tsk_skeleton", { assetType: "thumbnail", url: "bad" }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test("create rejects mismatched mime type", async () => {
    const { service, storage } = createService({});
    await expect(
      service.create(
        "tsk_skeleton",
        { assetType: "thumbnail", url: "https://cdn.example.com/t.mp4", mimeType: "video/mp4" },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.create).not.toHaveBeenCalled();
  });

  test("create maps duplicate asset to ConflictException", async () => {
    const { service } = createService({
      storage: {
        create: mock(async () => {
          throw new TemplateSkeletonAssetStorageError("duplicate", "DUPLICATE_ASSET");
        }),
      },
    });

    await expect(
      service.create(
        "tsk_skeleton",
        { assetType: "thumbnail", url: "https://cdn.example.com/t.webp" },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test("update patches metadata", async () => {
    const { service, storage } = createService({});
    const row = await service.update(
      "tsk_skeleton",
      "tsa_asset",
      { altText: "Updated" },
      actor,
    );
    expect(row.altText).toBe("Updated");
    expect(storage.update).toHaveBeenCalled();
  });

  test("update rejects empty patch", async () => {
    const { service } = createService({});
    await expect(
      service.update("tsk_skeleton", "tsa_asset", {}, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test("update rejects mismatched mime type", async () => {
    const { service, storage } = createService({});
    await expect(
      service.update(
        "tsk_skeleton",
        "tsa_asset",
        { mimeType: "video/mp4" },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.update).not.toHaveBeenCalled();
  });

  test("remove soft-deletes asset", async () => {
    const { service, storage } = createService({});
    const result = await service.remove("tsk_skeleton", "tsa_asset", actor);
    expect(result.ok).toBe(true);
    expect(storage.delete).toHaveBeenCalled();
  });

  test("remove maps not found", async () => {
    const { service } = createService({
      storage: {
        delete: mock(async () => {
          throw new TemplateSkeletonAssetStorageError("missing", "NOT_FOUND");
        }),
      },
    });

    await expect(service.remove("tsk_skeleton", "missing", actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
