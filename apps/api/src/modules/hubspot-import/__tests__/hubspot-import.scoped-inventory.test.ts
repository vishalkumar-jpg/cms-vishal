import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { BadRequestException, HttpStatus } from "@nestjs/common";
import {
  HUBSPOT_OB_SANDBOX_PORTAL_ID,
  HUBSPOT_PORTAL_INFO_API_PATH,
  HubspotApiError,
} from "@ob-cms/block-schema";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuditService } from "@common/audit/audit.service";
import type { PagesService } from "@modules/pages/pages.service";
import type { BlogService } from "@modules/blog/blog.service";
import type { ImportRunsService } from "@modules/connectors/import-runs.service";
import { HubspotImportService } from "../hubspot-import.service";
import { createMockHubspotAssetMigration } from "./hubspot-import-test-helpers";

const SCOPED_IMPORT_CONTEXT = { connectionId: "ccn_test", runId: "imr_test" } as const;

const HUBSPOT_ALLOWED_PORTAL_IDS_ENV = "HUBSPOT_ALLOWED_PORTAL_IDS";
const HUBSPOT_ALLOWED_PORTAL_ID_ENV = "HUBSPOT_ALLOWED_PORTAL_ID";

const actor = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

function createImportService() {
  const pagesCreate = mock(async () => ({ id: "pg_new" }));
  const blogCreate = mock(async () => ({ id: "post_new" }));
  const pages = {
    create: pagesCreate,
    list: mock(async () => []),
  } as unknown as PagesService;
  const blog = {
    create: blogCreate,
    list: mock(async () => []),
  } as unknown as BlogService;
  const audit = { record: mock(async () => undefined) } as unknown as AuditService;
  const repo = {
    siteId: "site_test",
    insertDefaults: () => ({ siteId: "site_test" }),
    scope: (_table: unknown, ...conditions: unknown[]) => conditions,
    db: {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(async () => []),
          })),
        })),
      })),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(async () => undefined),
        })),
      })),
    },
  } as unknown as ScopedRepository;
  const importRuns = { recordRunItem: mock(async () => undefined) } as unknown as ImportRunsService;
  const service = new HubspotImportService(
    repo,
    audit,
    pages,
    blog,
    importRuns,
    createMockHubspotAssetMigration(),
  );
  return { service, pagesCreate, blogCreate };
}

function mockFetchWithInventoryFailure(status: number): typeof fetch {
  return mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
      return new Response(JSON.stringify({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }), {
        status: 200,
      });
    }
    if (url.includes("/cms/v3/")) {
      return new Response(JSON.stringify({ message: "sensitive-hubspot-body" }), { status });
    }
    throw new Error(`Unexpected HubSpot fetch: ${url}`);
  }) as typeof fetch;
}

describe("HubspotImportService scoped inventory errors", () => {
  const originalFetch = globalThis.fetch;
  const originalPlural = process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
  const originalEnv = process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];

  beforeEach(() => {
    delete process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
    delete process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalPlural === undefined) {
      delete process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
    } else {
      process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV] = originalPlural;
    }
    if (originalEnv === undefined) {
      delete process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];
    } else {
      process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV] = originalEnv;
    }
  });

  test("previewScoped maps HubspotApiError from inventory fetch to BadRequestException", async () => {
    globalThis.fetch = mockFetchWithInventoryFailure(HttpStatus.UNAUTHORIZED);

    const { service } = createImportService();
    const rejection = service.previewScoped("pat-test-token", "all");

    await expect(rejection).rejects.toBeInstanceOf(BadRequestException);
    await expect(rejection).rejects.toThrow(
      "HubSpot rejected the token. Check the private-app token and scopes.",
    );
    await expect(rejection).rejects.not.toBeInstanceOf(HubspotApiError);

    try {
      await service.previewScoped("pat-test-token", "all");
      expect.unreachable("previewScoped should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err).not.toBeInstanceOf(HubspotApiError);
      const serialized = String(err);
      expect(serialized).not.toContain("pat-test-token");
      expect(serialized).not.toContain("sensitive-hubspot-body");
    }
  });

  test("runScoped maps HubspotApiError from inventory fetch to BadRequestException without importing", async () => {
    globalThis.fetch = mockFetchWithInventoryFailure(HttpStatus.FORBIDDEN);

    const { service, pagesCreate, blogCreate } = createImportService();
    const rejection = service.runScoped("pat-test-token", "published", actor, SCOPED_IMPORT_CONTEXT);

    await expect(rejection).rejects.toBeInstanceOf(BadRequestException);
    await expect(rejection).rejects.toThrow(
      "HubSpot rejected the token. Check the private-app token and scopes.",
    );
    await expect(rejection).rejects.not.toBeInstanceOf(HubspotApiError);

    expect(pagesCreate).not.toHaveBeenCalled();
    expect(blogCreate).not.toHaveBeenCalled();
  });
});
