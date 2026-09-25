import { describe, expect, mock, test } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import { SKELETON_CONTENT_SCHEMA_VERSION } from "@ob-cms/template-registry";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import { TemplateSkeletonsController } from "../template-skeletons.controller";
import type { TemplateSkeletonAssetsService } from "../template-skeleton-assets.service";
import type { TemplateSkeletonUsageService } from "../template-skeleton-usage.service";
import type { TemplateSkeletonVersionService } from "../template-skeleton-version.service";
import type { TemplateSkeletonsService } from "../template-skeletons.service";

const layout = emptyLayout();
const actor = { userId: "usr_test", email: "admin@test.com", isPlatformAdmin: true };

const skeletonRecord = {
  metadata: {
    id: "tsk_test",
    templateKey: "tpl-test",
    displayName: "Test",
    description: "Desc",
    category: "marketing" as const,
    supportedPageTypes: ["landing"],
    tags: [],
    previewMetadata: {},
    version: "1.0.0",
    status: "draft" as const,
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

const assetRecord = {
  id: "tsa_test",
  skeletonId: "tsk_test",
  assetType: "thumbnail" as const,
  storageKey: null,
  url: "https://cdn.example/thumb.png",
  mimeType: "image/png",
  width: null,
  height: null,
  size: null,
  altText: null,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createController(
  skeletons: TemplateSkeletonsService,
  skeletonVersions: TemplateSkeletonVersionService = {} as TemplateSkeletonVersionService,
  skeletonUsage: TemplateSkeletonUsageService = {} as TemplateSkeletonUsageService,
  assets: TemplateSkeletonAssetsService = {} as TemplateSkeletonAssetsService,
): TemplateSkeletonsController {
  return new TemplateSkeletonsController(skeletons, skeletonVersions, skeletonUsage, assets);
}

function mockResponse(): Response {
  const res = {
    status: mock(function (this: typeof res) {
      return this;
    }),
    send: mock(function (this: typeof res) {
      return this;
    }),
  };
  return res as unknown as Response;
}

const versionSummary = {
  skeletonId: "tsk_test",
  templateKey: "tpl-test",
  version: "1.4.0",
  createdAt: "2026-08-01T00:00:00.000Z",
  createdBy: null,
  metadata: skeletonRecord.metadata,
};

describe("TemplateSkeletonsController", () => {
  test("list delegates to skeletons service", async () => {
    const skeletons = {
      list: mock(async () => [skeletonRecord]),
    } as unknown as TemplateSkeletonsService;
    const controller = createController(skeletons);
    const res = mockResponse();

    await controller.list({ category: "marketing" }, res);

    expect(skeletons.list).toHaveBeenCalledWith({ category: "marketing" });
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: [skeletonRecord], status: StatusCodes.OK });
  });

  test("getByKey delegates to skeletons service", async () => {
    const skeletons = {
      getByKey: mock(async () => skeletonRecord),
    } as unknown as TemplateSkeletonsService;
    const controller = createController(skeletons);
    const res = mockResponse();

    await controller.getByKey("tpl-test", res);

    expect(skeletons.getByKey).toHaveBeenCalledWith("tpl-test");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: skeletonRecord, status: StatusCodes.OK });
  });

  test("create delegates body and actor to skeletons service", async () => {
    const skeletons = {
      create: mock(async () => skeletonRecord),
    } as unknown as TemplateSkeletonsService;
    const controller = createController(skeletons);
    const res = mockResponse();
    const body = { templateKey: "tpl-test", displayName: "Test" };

    await controller.create(body, actor, res);

    expect(skeletons.create).toHaveBeenCalledWith(body, actor);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(res.send).toHaveBeenCalledWith({ data: skeletonRecord, status: StatusCodes.CREATED });
  });

  test("createAsset delegates to assets service", async () => {
    const skeletons = {} as TemplateSkeletonsService;
    const assets = {
      create: mock(async () => assetRecord),
    } as unknown as TemplateSkeletonAssetsService;
    const controller = createController(skeletons, {} as TemplateSkeletonVersionService, {} as TemplateSkeletonUsageService, assets);
    const res = mockResponse();
    const body = { assetType: "thumbnail", url: "https://cdn.example/thumb.png" };

    await controller.createAsset("tsk_test", body, actor, res);

    expect(assets.create).toHaveBeenCalledWith("tsk_test", body, actor);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(res.send).toHaveBeenCalledWith({ data: assetRecord, status: StatusCodes.CREATED });
  });

  test("getById delegates to skeletons service", async () => {
    const skeletons = {
      getById: mock(async () => skeletonRecord),
    } as unknown as TemplateSkeletonsService;
    const controller = createController(skeletons);
    const res = mockResponse();

    await controller.getById("tsk_test", res);

    expect(skeletons.getById).toHaveBeenCalledWith("tsk_test");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: skeletonRecord, status: StatusCodes.OK });
  });

  test("update delegates to skeletons service", async () => {
    const skeletons = {
      update: mock(async () => skeletonRecord),
    } as unknown as TemplateSkeletonsService;
    const controller = createController(skeletons);
    const res = mockResponse();
    const body = { metadata: { displayName: "Updated" } };

    await controller.update("tsk_test", body, actor, res);

    expect(skeletons.update).toHaveBeenCalledWith("tsk_test", body, actor);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: skeletonRecord, status: StatusCodes.OK });
  });

  test("remove delegates to skeletons service", async () => {
    const removed = { ok: true as const };
    const skeletons = {
      remove: mock(async () => removed),
    } as unknown as TemplateSkeletonsService;
    const controller = createController(skeletons);
    const res = mockResponse();

    await controller.remove("tsk_test", actor, res);

    expect(skeletons.remove).toHaveBeenCalledWith("tsk_test", actor);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: removed, status: StatusCodes.OK });
  });

  test("listAssets delegates to assets service", async () => {
    const skeletons = {} as TemplateSkeletonsService;
    const assets = {
      list: mock(async () => []),
    } as unknown as TemplateSkeletonAssetsService;
    const controller = createController(skeletons, {} as TemplateSkeletonVersionService, {} as TemplateSkeletonUsageService, assets);
    const res = mockResponse();

    await controller.listAssets("tsk_test", res);

    expect(assets.list).toHaveBeenCalledWith("tsk_test");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: [], status: StatusCodes.OK });
  });

  test("updateAsset delegates to assets service", async () => {
    const skeletons = {} as TemplateSkeletonsService;
    const assets = {
      update: mock(async () => assetRecord),
    } as unknown as TemplateSkeletonAssetsService;
    const controller = createController(skeletons, {} as TemplateSkeletonVersionService, {} as TemplateSkeletonUsageService, assets);
    const res = mockResponse();
    const body = { url: "https://cdn.example/new.png" };

    await controller.updateAsset("tsk_test", "tsa_test", body, actor, res);

    expect(assets.update).toHaveBeenCalledWith("tsk_test", "tsa_test", body, actor);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: assetRecord, status: StatusCodes.OK });
  });

  test("getUsage delegates to usage service", async () => {
    const skeletons = {} as TemplateSkeletonsService;
    const usagePayload = {
      skeletonId: "tsk_test",
      templateKey: "tpl-test",
      totalPages: 2,
      lastUsedAt: "2026-08-03T00:00:00.000Z",
      currentVersion: "1.4.0",
      latestVersion: "1.4.0",
      pages: [],
      byVersion: [],
    };
    const skeletonUsage = {
      getUsageBySkeletonId: mock(async () => usagePayload),
    } as unknown as TemplateSkeletonUsageService;
    const controller = createController(skeletons, {} as TemplateSkeletonVersionService, skeletonUsage);
    const res = mockResponse();

    await controller.getUsage("tsk_test", res);

    expect(skeletonUsage.getUsageBySkeletonId).toHaveBeenCalledWith("tsk_test");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: usagePayload, status: StatusCodes.OK });
  });

  test("getTopUsage delegates to usage service", async () => {
    const skeletons = {} as TemplateSkeletonsService;
    const topPayload = [
      {
        skeletonId: "tsk_test",
        templateKey: "tpl-test",
        totalPages: 18,
        lastUsedAt: "2026-08-03T00:00:00.000Z",
      },
    ];
    const skeletonUsage = {
      getTopTemplates: mock(async () => topPayload),
    } as unknown as TemplateSkeletonUsageService;
    const controller = createController(skeletons, {} as TemplateSkeletonVersionService, skeletonUsage);
    const res = mockResponse();

    await controller.getTopUsage({ limit: 10 }, res);

    expect(skeletonUsage.getTopTemplates).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: topPayload, status: StatusCodes.OK });
  });

  test("listHistory delegates to version service", async () => {
    const skeletons = {} as TemplateSkeletonsService;
    const skeletonVersions = {
      listHistory: mock(async () => [versionSummary]),
    } as unknown as TemplateSkeletonVersionService;
    const controller = createController(skeletons, skeletonVersions);
    const res = mockResponse();

    await controller.listHistory("tsk_test", res);

    expect(skeletonVersions.listHistory).toHaveBeenCalledWith("tsk_test");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: [versionSummary], status: StatusCodes.OK });
  });

  test("getHistoryVersion delegates to version service", async () => {
    const skeletons = {} as TemplateSkeletonsService;
    const versionDetail = { ...versionSummary, content: skeletonRecord.content };
    const skeletonVersions = {
      getVersion: mock(async () => versionDetail),
    } as unknown as TemplateSkeletonVersionService;
    const controller = createController(skeletons, skeletonVersions);
    const res = mockResponse();

    await controller.getHistoryVersion("tsk_test", "1.4.0", res);

    expect(skeletonVersions.getVersion).toHaveBeenCalledWith("tsk_test", "1.4.0");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: versionDetail, status: StatusCodes.OK });
  });

  test("removeAsset delegates to assets service", async () => {
    const removed = { ok: true as const };
    const skeletons = {} as TemplateSkeletonsService;
    const assets = {
      remove: mock(async () => removed),
    } as unknown as TemplateSkeletonAssetsService;
    const controller = createController(skeletons, {} as TemplateSkeletonVersionService, {} as TemplateSkeletonUsageService, assets);
    const res = mockResponse();

    await controller.removeAsset("tsk_test", "tsa_test", actor, res);

    expect(assets.remove).toHaveBeenCalledWith("tsk_test", "tsa_test", actor);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: removed, status: StatusCodes.OK });
  });
});
