import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  HUBSPOT_BLOG_POST_LIST_PATH,
  HUBSPOT_OB_SANDBOX_PORTAL_ID,
  HUBSPOT_PORTAL_INFO_API_PATH,
  HUBSPOT_PUBLISHED_STATE,
  hubspotBlogPostGetPath,
} from "@ob-cms/block-schema";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuditService } from "@common/audit/audit.service";
import type { PagesService } from "@modules/pages/pages.service";
import type { BlogService } from "@modules/blog/blog.service";
import type { ImportRunsService } from "@modules/connectors/import-runs.service";
import { HubspotImportService } from "../hubspot-import.service";
import { createMockHubspotAssetMigration } from "./hubspot-import-test-helpers";

const SCOPED_IMPORT_CONTEXT = {
  connectionId: "ccn_test",
  runId: "imr_test",
} as const;

const HUBSPOT_ALLOWED_PORTAL_IDS_ENV = "HUBSPOT_ALLOWED_PORTAL_IDS";
const HUBSPOT_ALLOWED_PORTAL_ID_ENV = "HUBSPOT_ALLOWED_PORTAL_ID";

const actor = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

function createImportService() {
  const pagesCreate = mock(async () => ({ id: "pg_new" }));
  const pagesPublish = mock(async () => ({ id: "pg_new", status: "published" }));
  const blogCreate = mock(async () => ({ id: "post_new", terms: [] }));
  const blogPublish = mock(async () => ({ id: "post_new", status: "published" }));
  const auditRecord = mock(async () => undefined);

  const pages = {
    create: pagesCreate,
    publish: pagesPublish,
    list: mock(async () => []),
  } as unknown as PagesService;
  const blog = {
    create: blogCreate,
    publish: blogPublish,
    list: mock(async () => []),
  } as unknown as BlogService;
  const audit = { record: auditRecord } as unknown as AuditService;
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
  return { service, pagesCreate, pagesPublish, blogCreate, blogPublish, auditRecord };
}

function mockFetchWithSinglePage(state: string): typeof fetch {
  return mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
      return new Response(JSON.stringify({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }), {
        status: 200,
      });
    }
    if (url.includes("/cms/v3/pages/site-pages") && !url.includes("/cms/v3/pages/site-pages/")) {
      return new Response(
        JSON.stringify({
          results: [{ id: "page-1", name: "About", slug: "about", state }],
        }),
        { status: 200 },
      );
    }
    if (url.includes("/cms/v3/pages/landing-pages")) {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    if (url.includes(hubspotBlogPostGetPath("post-1"))) {
      return new Response(
        JSON.stringify({
          id: "post-1",
          name: "Launch post",
          slug: "launch-post",
          state,
          postBody: "<p>Blog</p>",
        }),
        { status: 200 },
      );
    }
    if (
      url.includes(HUBSPOT_BLOG_POST_LIST_PATH) &&
      !url.includes(`${HUBSPOT_BLOG_POST_LIST_PATH}/`)
    ) {
      return new Response(
        JSON.stringify({
          results: [{ id: "post-1", name: "Launch post", slug: "launch-post", state }],
        }),
        { status: 200 },
      );
    }
    if (url.includes("/cms/v3/pages/site-pages/page-1")) {
      return new Response(
        JSON.stringify({
          id: "page-1",
          name: "About",
          slug: "about",
          state,
          html: "<p>Hi</p>",
        }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected HubSpot fetch: ${url}`);
  }) as typeof fetch;
}

describe("HubspotImportService scoped publish-state mapping", () => {
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

  test("runScoped publishes OB pages when HubSpot detail state is published", async () => {
    globalThis.fetch = mockFetchWithSinglePage(HUBSPOT_PUBLISHED_STATE);
    const { service, pagesCreate, pagesPublish, blogCreate, blogPublish } = createImportService();

    await service.runScoped("pat-test-token", "all", actor, SCOPED_IMPORT_CONTEXT);

    expect(pagesCreate).toHaveBeenCalled();
    expect(pagesPublish).toHaveBeenCalledWith("pg_new", actor);
    expect(blogCreate).toHaveBeenCalled();
    expect(blogPublish).toHaveBeenCalledWith("post_new", actor);
  });

  test("runScoped leaves OB pages as draft when HubSpot detail state is not published", async () => {
    globalThis.fetch = mockFetchWithSinglePage("DRAFT");
    const { service, pagesCreate, pagesPublish } = createImportService();

    await service.runScoped("pat-test-token", "all", actor, SCOPED_IMPORT_CONTEXT);

    expect(pagesCreate).toHaveBeenCalled();
    expect(pagesPublish).not.toHaveBeenCalled();
  });

  test("runScoped records connectionId on audit when context is provided", async () => {
    globalThis.fetch = mockFetchWithSinglePage(HUBSPOT_PUBLISHED_STATE);
    const { service, auditRecord } = createImportService();

    await service.runScoped("pat-test-token", "published", actor, SCOPED_IMPORT_CONTEXT);

    expect(auditRecord).toHaveBeenCalled();
    const auditCall = auditRecord.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
    expect(auditCall.metadata?.connectionId).toBe("ccn_test");
    expect(auditCall.metadata?.mode).toBe("connection-scoped");
  });

  test("runScoped with published scope skips non-published inventory items", async () => {
    globalThis.fetch = mockFetchWithSinglePage("DRAFT");
    const { service, pagesCreate, pagesPublish } = createImportService();

    const summary = await service.runScoped("pat-test-token", "published", actor, SCOPED_IMPORT_CONTEXT);

    expect(pagesCreate).not.toHaveBeenCalled();
    expect(pagesPublish).not.toHaveBeenCalled();
    expect(summary.importedPages).toBe(0);
  });

  test("runScoped records skipped page when publish fails after create", async () => {
    globalThis.fetch = mockFetchWithSinglePage(HUBSPOT_PUBLISHED_STATE);
    const { service, pagesCreate, pagesPublish } = createImportService();
    pagesPublish.mockImplementation(async () => {
      throw new Error("Publish failed");
    });

    const summary = await service.runScoped("pat-test-token", "all", actor, SCOPED_IMPORT_CONTEXT);

    expect(pagesCreate).toHaveBeenCalled();
    expect(pagesPublish).toHaveBeenCalled();
    expect(summary.importedPages).toBe(0);
    expect(summary.skipped).toHaveLength(1);
    expect(summary.skipped[0]?.name).toBe("page:page-1");
  });

  test("legacy run does not publish imported pages", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
        return new Response(JSON.stringify({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }), {
          status: 200,
        });
      }
      if (url.includes("/cms/v3/pages/page-1")) {
        return new Response(
          JSON.stringify({
            id: "page-1",
            name: "About",
            slug: "about",
            state: HUBSPOT_PUBLISHED_STATE,
            html: "<p>Hi</p>",
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected HubSpot fetch: ${url}`);
    }) as typeof fetch;

    const { service, pagesCreate, pagesPublish } = createImportService();
    await service.run({ token: "pat-test-token", pageIds: ["page-1"], postIds: [] }, actor);

    expect(pagesCreate).toHaveBeenCalled();
    expect(pagesPublish).not.toHaveBeenCalled();
  });
});
