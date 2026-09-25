import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
  type HubspotDiscoveredAsset,
  type HubspotUniversalPage,
} from "@ob-cms/block-schema";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { MediaService } from "@modules/media/media.service";
import { HubspotAssetMigrationService } from "../hubspot-asset-migration.service";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

const asset = (url: string): HubspotDiscoveredAsset => ({
  url,
  normalizedUrl: url,
  identityKey: `url:${url}`,
  discoveredAtPath: "/src",
});

describe("HubspotAssetMigrationService fetch security", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mock(async () => new Response(null, { status: 404 })) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("sends Authorization only to api.hubapi.com", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, headers });
      if (url.includes("api.hubapi.com")) {
        return new Response(JPEG_BYTES, {
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": String(JPEG_BYTES.length) },
        });
      }
      return new Response(JPEG_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(JPEG_BYTES.length) },
      });
    }) as typeof fetch;

    const limit = mock(async () => []);
    const onConflictDoNothing = mock(async () => undefined);
    const insertValues = mock(() => ({ onConflictDoNothing }));
    const repo = {
      siteId: "site_test",
      insertDefaults: () => ({ siteId: "site_test", id: "cam_new" }),
      scope: (...c: unknown[]) => c,
      db: {
        select: mock(() => ({ from: mock(() => ({ where: mock(() => ({ limit })) })) })),
        insert: mock(() => ({ values: insertValues })),
        update: mock(() => ({ set: mock(() => ({ where: mock(async () => undefined) })) })),
      },
    } as unknown as ScopedRepository;

    const service = new HubspotAssetMigrationService(repo, {
      importFromBytes: mock(async () => ({ id: "med_1", url: "https://media.ob/a.jpg" })),
    } as unknown as MediaService);

    const upm = {
      modelVersion: HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
      assets: [
        asset("https://api.hubapi.com/file-manager/v3/files/123"),
        asset("https://cdn2.hubspot.net/hubfs/123/photo.jpg"),
      ],
      sourceRecord: {},
    } as HubspotUniversalPage;

    await service.migrateUpmAssets("ccn", upm, "secret-token", {
      userId: "u",
      email: "e",
      isPlatformAdmin: false,
    });

    const apiCall = calls.find((c) => c.url.includes("api.hubapi.com"));
    const cdnCall = calls.find((c) => c.url.includes("cdn2.hubspot.net"));
    expect(apiCall?.headers.Authorization).toBe("Bearer secret-token");
    expect(cdnCall?.headers.Authorization).toBeUndefined();
  });

  test("rejects redirect to unapproved host", async () => {
    globalThis.fetch = mock(async () =>
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/evil" } }),
    ) as typeof fetch;

    const limit = mock(async () => []);
    const repo = {
      siteId: "site_test",
      insertDefaults: () => ({ siteId: "site_test", id: "cam_new" }),
      scope: (...c: unknown[]) => c,
      db: {
        select: mock(() => ({ from: mock(() => ({ where: mock(() => ({ limit })) })) })),
        insert: mock(() => ({ values: mock(() => ({ onConflictDoNothing: mock(async () => undefined) })) })),
        update: mock(() => ({ set: mock(() => ({ where: mock(async () => undefined) })) })),
      },
    } as unknown as ScopedRepository;

    const service = new HubspotAssetMigrationService(repo, {
      importFromBytes: mock(async () => ({ id: "med_1", url: "https://media.ob/a.jpg" })),
    } as unknown as MediaService);

    const { urlMap } = await service.migrateUpmAssets(
      "ccn",
      {
        modelVersion: HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
        assets: [asset("https://cdn2.hubspot.net/hubfs/1/a.jpg")],
        sourceRecord: {},
      } as HubspotUniversalPage,
      "token",
      { userId: "u", email: "e", isPlatformAdmin: false },
    );

    expect(urlMap["https://cdn2.hubspot.net/hubfs/1/a.jpg"]).toBeUndefined();
  });

  test("follows redirect to another approved HubSpot asset host", async () => {
    let callCount = 0;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      callCount += 1;
      const url = String(input);
      if (callCount === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://12345.hsfs1.hubspotusercontent-na1.net/redirected.jpg" },
        });
      }
      if (url.includes("hubspotusercontent-na1.net")) {
        return new Response(JPEG_BYTES, {
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": String(JPEG_BYTES.length) },
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const limit = mock(async () => []);
    const repo = {
      siteId: "site_test",
      insertDefaults: () => ({ siteId: "site_test", id: "cam_new" }),
      scope: (...c: unknown[]) => c,
      db: {
        select: mock(() => ({ from: mock(() => ({ where: mock(() => ({ limit })) })) })),
        insert: mock(() => ({ values: mock(() => ({ onConflictDoNothing: mock(async () => undefined) })) })),
        update: mock(() => ({ set: mock(() => ({ where: mock(async () => undefined) })) })),
      },
    } as unknown as ScopedRepository;

    const service = new HubspotAssetMigrationService(repo, {
      importFromBytes: mock(async () => ({ id: "med_1", url: "https://media.ob/a.jpg" })),
    } as unknown as MediaService);

    const { urlMap } = await service.migrateUpmAssets(
      "ccn",
      {
        modelVersion: HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
        assets: [asset("https://cdn2.hubspot.net/hubfs/1/a.jpg")],
        sourceRecord: {},
      } as HubspotUniversalPage,
      "token",
      { userId: "u", email: "e", isPlatformAdmin: false },
    );

    expect(callCount).toBe(2);
    expect(urlMap["https://cdn2.hubspot.net/hubfs/1/a.jpg"]).toBe("https://media.ob/a.jpg");
  });
});
