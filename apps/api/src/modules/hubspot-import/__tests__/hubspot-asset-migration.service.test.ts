import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES,
  HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
  type HubspotDiscoveredAsset,
  type HubspotUniversalPage,
} from "@ob-cms/block-schema";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { MediaService } from "@modules/media/media.service";
import { HubspotAssetMigrationService } from "../hubspot-asset-migration.service";

const actor = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

const HUBSPOT_ASSET_URL = "https://cdn2.hubspot.net/hubfs/123/photo.jpg";

const sampleAsset = (overrides?: Partial<HubspotDiscoveredAsset>): HubspotDiscoveredAsset => ({
  url: HUBSPOT_ASSET_URL,
  normalizedUrl: "https://cdn2.hubspot.net/hubfs/123/photo.jpg",
  identityKey: "hubspot:hubfs:123/photo.jpg",
  discoveredAtPath: "/layoutSections/params/image/src",
  ...overrides,
});

const sampleUpm = (assets: HubspotDiscoveredAsset[]): HubspotUniversalPage =>
  ({
    modelVersion: HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
    source: { kind: "page", hsId: "pg-1", extractedAtIso: "2026-01-01T00:00:00.000Z" },
    metadata: {},
    regions: [],
    sourceRecord: { layoutSections: { img: { src: assets[0]?.url ?? "" } } },
    assets,
    diagnostics: [],
    legacyHtmlParts: { layoutHtml: "", widgetHtml: "" },
    digest: "test",
  }) as HubspotUniversalPage;

function createServiceHarness(
  mediaRows = [
    {
      id: "med_1",
      url: "https://media.ob.test/sites/site_test/photo.jpg",
      status: "processing",
    },
  ],
) {
  const selectLimitResults: unknown[][] = [];
  const insertValuesCalls: unknown[] = [];
  const updateSetCalls: unknown[] = [];

  const limit = mock(async () => selectLimitResults.shift() ?? []);
  const onConflictDoNothing = mock(async () => undefined);
  const insertValues = mock((values: unknown) => {
    insertValuesCalls.push(values);
    return { onConflictDoNothing };
  });
  const updateSet = mock((values: unknown) => {
    updateSetCalls.push(values);
    return { where: mock(async () => undefined) };
  });

  const repo = {
    siteId: "site_test",
    insertDefaults: () => ({
      siteId: "site_test",
      id: "cam_new",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    }),
    scope: (...conditions: unknown[]) => conditions,
    db: {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => ({ limit })),
        })),
      })),
      insert: mock(() => ({ values: insertValues })),
      update: mock(() => ({ set: updateSet })),
    },
  } as unknown as ScopedRepository;

  let mediaRowIndex = 0;
  const importFromBytes = mock(async () =>
    mediaRows[Math.min(mediaRowIndex++, mediaRows.length - 1)],
  );
  const remove = mock(async () => ({ ok: true as const }));

  const media = { importFromBytes, remove } as unknown as MediaService;
  const service = new HubspotAssetMigrationService(repo, media);

  return {
    service,
    selectLimitResults,
    insertValuesCalls,
    updateSetCalls,
    importFromBytes,
    remove,
  };
}

describe("HubspotAssetMigrationService", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mock(async () =>
      Response.json({}, { status: 404 }),
    ) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("reuses ready mapping without download or media import", async () => {
    const { service, selectLimitResults, importFromBytes, insertValuesCalls } = createServiceHarness();
    selectLimitResults.push([
      { id: "cam_ready", status: "ready", obUrl: "https://media.ob.test/existing.jpg" },
    ]);

    const asset = sampleAsset();
    const { urlMap, diagnostics } = await service.migrateUpmAssets(
      "ccn_1",
      sampleUpm([asset]),
      "token",
      actor,
    );

    expect(urlMap[asset.url]).toBe("https://media.ob.test/existing.jpg");
    expect(importFromBytes).not.toHaveBeenCalled();
    expect(insertValuesCalls.length).toBe(0);
    expect(diagnostics.some((d) => d.code === HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_REUSED_EXISTING)).toBe(
      true,
    );
  });

  test("downloads, imports media, and inserts ready mapping on first success", async () => {
    const { service, selectLimitResults, importFromBytes, insertValuesCalls } = createServiceHarness();
    selectLimitResults.push(
      [],
      [{ id: "cam_new", status: "failed", mediaId: null, obUrl: null }],
      [{ id: "cam_new", status: "ready", obUrl: "https://media.ob.test/sites/site_test/photo.jpg" }],
    );

    globalThis.fetch = mock(async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(JPEG_BYTES.length) },
      }),
    ) as typeof fetch;

    const asset = sampleAsset();
    const { urlMap } = await service.migrateUpmAssets("ccn_1", sampleUpm([asset]), "token", actor);

    expect(importFromBytes).toHaveBeenCalledTimes(1);
    expect(insertValuesCalls.length).toBe(1);
    expect((insertValuesCalls[0] as { status: string }).status).toBe("ready");
    expect(urlMap[asset.url]).toBe("https://media.ob.test/sites/site_test/photo.jpg");
  });

  test("updates failed mapping row on retry after successful download", async () => {
    const { service, selectLimitResults, importFromBytes, insertValuesCalls, updateSetCalls } =
      createServiceHarness();
    selectLimitResults.push(
      [],
      [{ id: "cam_failed", status: "failed", obUrl: null, mediaId: null }],
      [{ id: "cam_failed", status: "ready", obUrl: "https://media.ob.test/sites/site_test/photo.jpg" }],
    );

    globalThis.fetch = mock(async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    ) as typeof fetch;

    const asset = sampleAsset();
    await service.migrateUpmAssets("ccn_1", sampleUpm([asset]), "token", actor);

    expect(importFromBytes).toHaveBeenCalledTimes(1);
    expect(insertValuesCalls.length).toBe(1);
    expect(updateSetCalls.length).toBe(1);
    expect((updateSetCalls[0] as { status: string }).status).toBe("ready");
    expect((updateSetCalls[0] as { error: null }).error).toBe(null);
  });

  test("retries media processing on a later import after a failed media row", async () => {
    const failedUrl = "https://media.ob.test/sites/site_test/failed-photo.jpg";
    const readyUrl = "https://media.ob.test/sites/site_test/retried-photo.jpg";
    const { service, selectLimitResults, importFromBytes, insertValuesCalls, remove } =
      createServiceHarness([
        { id: "med_failed", url: failedUrl, status: "failed" },
        { id: "med_retry", url: readyUrl, status: "processing" },
      ]);
    selectLimitResults.push(
      [],
      [],
      [{ id: "cam_failed", status: "failed", obUrl: null, mediaId: null }],
      [],
      [{ id: "cam_failed", status: "failed", obUrl: null, mediaId: null }],
      [{ id: "cam_failed", status: "ready", obUrl: readyUrl, mediaId: "med_retry" }],
    );

    globalThis.fetch = mock(async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    ) as typeof fetch;

    const asset = sampleAsset();
    const first = await service.migrateUpmAssets("ccn_1", sampleUpm([asset]), "token", actor);
    const second = await service.migrateUpmAssets("ccn_1", sampleUpm([asset]), "token", actor);

    expect(first.urlMap[asset.url]).toBeUndefined();
    expect(second.urlMap[asset.url]).toBe(readyUrl);
    expect(importFromBytes).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith("med_failed", actor);
    expect((insertValuesCalls[0] as { status: string }).status).toBe("failed");
    expect((insertValuesCalls[1] as { status: string }).status).toBe("ready");
  });

  test("removes the losing media import when a ready mapping wins the conflict", async () => {
    const { service, selectLimitResults, remove, updateSetCalls } = createServiceHarness();
    selectLimitResults.push(
      [],
      [
        {
          id: "cam_winner",
          status: "ready",
          mediaId: "med_winner",
          obUrl: "https://media.ob.test/winner.jpg",
        },
      ],
      [
        {
          id: "cam_winner",
          status: "ready",
          mediaId: "med_winner",
          obUrl: "https://media.ob.test/winner.jpg",
        },
      ],
    );

    globalThis.fetch = mock(async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    ) as typeof fetch;

    const asset = sampleAsset();
    const result = await service.migrateUpmAssets("ccn_1", sampleUpm([asset]), "token", actor);

    expect(remove).toHaveBeenCalledWith("med_1", actor);
    expect(updateSetCalls).toHaveLength(0);
    expect(result.urlMap[asset.url]).toBe("https://media.ob.test/winner.jpg");
  });

  test("records failed mapping when download fails", async () => {
    const { service, selectLimitResults, insertValuesCalls, importFromBytes } = createServiceHarness();
    selectLimitResults.push([], [], []);

    globalThis.fetch = mock(async () => new Response(null, { status: 502 })) as typeof fetch;

    const asset = sampleAsset();
    const { urlMap, diagnostics } = await service.migrateUpmAssets(
      "ccn_1",
      sampleUpm([asset]),
      "token",
      actor,
    );

    expect(urlMap[asset.url]).toBeUndefined();
    expect(importFromBytes).not.toHaveBeenCalled();
    expect(insertValuesCalls.length).toBe(1);
    expect((insertValuesCalls[0] as { status: string }).status).toBe("failed");
    expect(
      diagnostics.some((d) => d.code === HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_DOWNLOAD_FAILED),
    ).toBe(true);
  });

  test("updates existing failed row when download fails again", async () => {
    const { service, selectLimitResults, insertValuesCalls, updateSetCalls } = createServiceHarness();
    selectLimitResults.push([], [], [{ id: "cam_failed", status: "failed" }]);

    globalThis.fetch = mock(async () => new Response(null, { status: 404 })) as typeof fetch;

    await service.migrateUpmAssets("ccn_1", sampleUpm([sampleAsset()]), "token", actor);

    expect(insertValuesCalls.length).toBe(1);
    expect(updateSetCalls.length).toBe(1);
    expect((updateSetCalls[0] as { status: string }).status).toBe("failed");
  });

  test("emits responsive preserved diagnostic when responsive_variant asset migrates", async () => {
    const { service, selectLimitResults } = createServiceHarness();
    selectLimitResults.push(
      [],
      [{ id: "cam_new", status: "failed", mediaId: null, obUrl: null }],
      [{ id: "cam_new", status: "ready", obUrl: "https://media.ob.test/sites/site_test/photo.jpg" }],
    );

    globalThis.fetch = mock(async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    ) as typeof fetch;

    const asset = sampleAsset({
      url: "https://cdn2.hubspot.net/hubfs/123/mobile/photo.jpg",
      normalizedUrl: "https://cdn2.hubspot.net/hubfs/123/mobile/photo.jpg",
      identityKey: "hubspot:hubfs:123/mobile/photo.jpg",
      discoveredAtPath: "/params/mobile/image/src",
      role: "responsive_variant",
    });

    const { diagnostics } = await service.migrateUpmAssets(
      "ccn_1",
      sampleUpm([asset]),
      "token",
      actor,
    );

    expect(
      diagnostics.some(
        (d) => d.code === HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_RESPONSIVE_SOURCE_PRESERVED,
      ),
    ).toBe(true);
  });

  test("uses onConflictDoNothing for mapping insert (concurrency-safe)", async () => {
    const onConflictDoNothing = mock(async () => undefined);
    const insertValues = mock(() => ({ onConflictDoNothing }));
    const limit = mock(async () => []);
    const repo = {
      siteId: "site_test",
      insertDefaults: () => ({ siteId: "site_test", id: "cam_new" }),
      scope: (...conditions: unknown[]) => conditions,
      db: {
        select: mock(() => ({ from: mock(() => ({ where: mock(() => ({ limit })) })) })),
        insert: mock(() => ({ values: insertValues })),
        update: mock(() => ({ set: mock(() => ({ where: mock(async () => undefined) })) })),
      },
    } as unknown as ScopedRepository;

    const service = new HubspotAssetMigrationService(repo, {
      importFromBytes: mock(async () => ({ id: "med_1", url: "https://media.ob/a.jpg" })),
    } as unknown as MediaService);

    globalThis.fetch = mock(async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(JPEG_BYTES.length) },
      }),
    ) as typeof fetch;

    await service.migrateUpmAssets("ccn_1", sampleUpm([sampleAsset()]), "token", actor);
    expect(onConflictDoNothing).toHaveBeenCalled();
    expect(onConflictDoNothing.mock.calls[0]).toEqual([]);
  });
});
