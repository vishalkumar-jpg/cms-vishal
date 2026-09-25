import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import {
  HUBSPOT_OB_SANDBOX_PORTAL_ID,
  HUBSPOT_PORTAL_INFO_API_PATH,
} from "@ob-cms/block-schema";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuditService } from "@common/audit/audit.service";
import type { PagesService } from "@modules/pages/pages.service";
import type { BlogService } from "@modules/blog/blog.service";
import type { ImportRunsService } from "@modules/connectors/import-runs.service";
import { HubspotImportService } from "../hubspot-import.service";
import { createMockHubspotAssetMigration } from "./hubspot-import-test-helpers";

function createImportService(): HubspotImportService {
  const pages = {
    create: mock(async () => ({ id: "pg_new" })),
    list: mock(async () => []),
  } as unknown as PagesService;
  const blog = {
    create: mock(async () => ({ id: "post_new" })),
    list: mock(async () => []),
  } as unknown as BlogService;
  const audit = { record: mock(async () => undefined) } as unknown as AuditService;
  const repo = { siteId: "site_test" } as unknown as ScopedRepository;
  const importRuns = { recordRunItem: mock(async () => undefined) } as unknown as ImportRunsService;
  return new HubspotImportService(
    repo,
    audit,
    pages,
    blog,
    importRuns,
    createMockHubspotAssetMigration(),
  );
}

describe("HubspotImportService portal allowlist", () => {
  const originalFetch = globalThis.fetch;
  const originalPlural = process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
  const originalEnv = process.env.HUBSPOT_ALLOWED_PORTAL_ID;

  beforeEach(() => {
    delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalPlural === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_IDS = originalPlural;
    }
    if (originalEnv === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_ID = originalEnv;
    }
  });

  test("preview rejects disallowed portal before CMS list requests", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
        return new Response(JSON.stringify({ portalId: 99999999 }), { status: 200 });
      }
      throw new Error(`Unexpected HubSpot fetch: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const service = createImportService();
    await expect(service.preview("pat-disallowed")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.preview("pat-disallowed")).rejects.toThrow(/not allowed/);
    expect(
      fetchMock.mock.calls.every(([url]) => String(url).includes(HUBSPOT_PORTAL_INFO_API_PATH)),
    ).toBe(true);
  });

  test("preview allows configured sandbox portal", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
        return new Response(JSON.stringify({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }), {
          status: 200,
        });
      }
      if (url.includes("/cms/v3/pages") || url.includes("/cms/v3/blogs/posts")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      throw new Error(`Unexpected HubSpot fetch: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const service = createImportService();
    await expect(service.preview("pat-allowed")).resolves.toEqual({ pages: [], posts: [] });
  });
});
