import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  HUBSPOT_BLOG_POST_LIST_PATH,
  HUBSPOT_CONTENT_KIND_BLOG_POST,
  HUBSPOT_OB_SANDBOX_PORTAL_ID,
  HUBSPOT_PORTAL_INFO_API_PATH,
  HUBSPOT_PUBLISHED_STATE,
  hubspotBlogPostGetPath,
} from "@ob-cms/block-schema";
import type { PageRow, PostRow } from "@database/schema";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuditService } from "@common/audit/audit.service";
import type { PagesService } from "@modules/pages/pages.service";
import type { BlogService } from "@modules/blog/blog.service";
import type { ImportRunsService } from "@modules/connectors/import-runs.service";
import { HubspotImportService } from "../hubspot-import.service";
import { createMockHubspotAssetMigration } from "./hubspot-import-test-helpers";

const HUBSPOT_ALLOWED_PORTAL_IDS_ENV = "HUBSPOT_ALLOWED_PORTAL_IDS";
const HUBSPOT_ALLOWED_PORTAL_ID_ENV = "HUBSPOT_ALLOWED_PORTAL_ID";

const actor = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

const CONNECTION_A = "ccn_a";
const CONNECTION_B = "ccn_b";
const RUN_ID = "imr_test";

function mockFetchPublishedPageAndPost(): typeof fetch {
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
          results: [{ id: "page-1", name: "About", slug: "about", state: HUBSPOT_PUBLISHED_STATE }],
        }),
        { status: 200 },
      );
    }
    if (url.includes("/cms/v3/pages/landing-pages")) {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    if (url.includes("/cms/v3/pages/site-pages/page-1")) {
      return new Response(
        JSON.stringify({
          id: "page-1",
          name: "About",
          slug: "about",
          state: HUBSPOT_PUBLISHED_STATE,
          html: "<p>Page</p>",
        }),
        { status: 200 },
      );
    }
    if (url.includes(hubspotBlogPostGetPath("post-1"))) {
      return new Response(
        JSON.stringify({
          id: "post-1",
          name: "Blog",
          slug: "blog",
          state: "DRAFT",
          postBody: "<p>Post</p>",
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
          results: [{ id: "post-1", name: "Blog", slug: "blog", state: "DRAFT" }],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  });
}

function createIdempotentImportService(
  existingPages: PageRow[] = [],
  existingPosts: PostRow[] = [],
  connectionFilter: string = CONNECTION_A,
) {
  const pagesCreate = mock(async () => ({ id: "pg_new", title: "About", slug: "about", status: "draft" }));
  const pagesPublish = mock(async () => ({ id: "pg_existing", status: "published" }));
  const pagesSaveDraft = mock(async (id: string) => ({ id, title: "About", slug: "about", status: "draft" }));
  const pagesUpdate = mock(async (id: string) => ({ id, title: "About", slug: "about", status: "draft" }));

  const blogCreate = mock(async () => ({ id: "post_new", title: "Blog", slug: "blog", status: "draft" }));
  const blogPublish = mock(async () => ({ id: "post_new", status: "published" }));
  const blogUpdate = mock(async (id: string) => ({ id, title: "Blog", slug: "blog", status: "draft" }));

  const pages = {
    create: pagesCreate,
    publish: pagesPublish,
    saveDraft: pagesSaveDraft,
    update: pagesUpdate,
    list: mock(async () => []),
  } as unknown as PagesService;
  const blog = {
    create: blogCreate,
    publish: blogPublish,
    update: blogUpdate,
    list: mock(async () => []),
  } as unknown as BlogService;
  const audit = { record: mock(async () => undefined) } as unknown as AuditService;

  const recordRunItem = mock(async () => undefined);
  const importRuns = { recordRunItem } as unknown as ImportRunsService;

  let lookupCall = 0;
  const repo = {
    siteId: "site_test",
    insertDefaults: () => ({ siteId: "site_test" }),
    scope: (_table: unknown, ...conditions: unknown[]) => conditions,
    db: {
      select: mock(() => ({
        from: mock((_table: unknown) => ({
          where: mock(() => ({
            limit: mock(async () => {
              lookupCall += 1;
              if (lookupCall % 2 === 1) {
                return existingPages.filter((p) => p.hubspotConnectionId === connectionFilter);
              }
              return existingPosts.filter((p) => p.hubspotConnectionId === connectionFilter);
            }),
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

  const service = new HubspotImportService(
    repo,
    audit,
    pages,
    blog,
    importRuns,
    createMockHubspotAssetMigration(),
  );
  return {
    service,
    pagesCreate,
    pagesPublish,
    pagesSaveDraft,
    blogCreate,
    blogUpdate,
    recordRunItem,
  };
}

const basePageRow = (overrides: Partial<PageRow>): PageRow =>
  ({
    id: "pg_existing",
    siteId: "site_test",
    title: "About",
    slug: "about",
    locale: "en",
    translationKey: "pg_existing",
    status: "draft",
    workflowState: "draft",
    seo: {},
    schemaVersion: "2.0",
    layoutOptions: {},
    hubspotConnectionId: CONNECTION_A,
    hubspotKind: "page",
    hubspotHsId: "page-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    draftLayout: null,
    publishedLayout: null,
    parentId: null,
    reviewerId: null,
    reviewNote: null,
    submittedAt: null,
    reviewedAt: null,
    scheduledAt: null,
    publishedAt: null,
    expiresAt: null,
    previewToken: null,
    sourceTemplateId: null,
    sourceTemplateKey: null,
    sourceTemplateVersion: null,
    instantiatedAt: null,
    ...overrides,
  }) as PageRow;

describe("HubspotImportService connection-scoped idempotency", () => {
  const originalFetch = globalThis.fetch;
  const originalPlural = process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
  const originalEnv = process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];

  beforeEach(() => {
    delete process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
    delete process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalPlural === undefined) delete process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
    else process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV] = originalPlural;
    if (originalEnv === undefined) delete process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];
    else process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV] = originalEnv;
  });

  test("first scoped import creates page and post", async () => {
    globalThis.fetch = mockFetchPublishedPageAndPost();
    const { service, pagesCreate, blogCreate } = createIdempotentImportService();

    const summary = await service.runScoped("pat-test", "all", actor, {
      connectionId: CONNECTION_A,
      runId: RUN_ID,
    });

    expect(pagesCreate).toHaveBeenCalledTimes(1);
    expect(blogCreate).toHaveBeenCalledTimes(1);
    expect(summary.importedPages).toBe(1);
    expect(summary.importedPosts).toBe(1);
  });

  test("second import reuses linked page and post without create", async () => {
    globalThis.fetch = mockFetchPublishedPageAndPost();
    const existingPage = basePageRow({});
    const existingPost = {
      id: "post_existing",
      siteId: "site_test",
      title: "Blog",
      slug: "blog",
      locale: "en",
      status: "draft",
      workflowState: "draft",
      seo: {},
      hubspotConnectionId: CONNECTION_A,
      hubspotKind: HUBSPOT_CONTENT_KIND_BLOG_POST,
      hubspotHsId: "post-1",
    } as PostRow;
    const { service, pagesCreate, pagesSaveDraft, blogCreate, blogUpdate } =
      createIdempotentImportService([existingPage], [existingPost]);

    const summary = await service.runScoped("pat-test", "all", actor, {
      connectionId: CONNECTION_A,
      runId: RUN_ID,
    });

    expect(pagesCreate).not.toHaveBeenCalled();
    expect(pagesSaveDraft).toHaveBeenCalled();
    expect(blogCreate).not.toHaveBeenCalled();
    expect(blogUpdate).toHaveBeenCalled();
    expect(summary.updatedPages).toBe(1);
    expect(summary.updatedPosts).toBe(1);
  });

  test("same hsId on a different connection creates new content", async () => {
    globalThis.fetch = mockFetchPublishedPageAndPost();
    const existingPage = basePageRow({ hubspotConnectionId: CONNECTION_A });
    const { service, pagesCreate } = createIdempotentImportService(
      [existingPage],
      [],
      CONNECTION_B,
    );

    await service.runScoped("pat-test", "all", actor, {
      connectionId: CONNECTION_B,
      runId: RUN_ID,
    });

    expect(pagesCreate).toHaveBeenCalledTimes(1);
  });

  test("records import run items when runId is provided", async () => {
    globalThis.fetch = mockFetchPublishedPageAndPost();
    const { service, recordRunItem } = createIdempotentImportService();

    await service.runScoped("pat-test", "all", actor, {
      connectionId: CONNECTION_A,
      runId: RUN_ID,
    });

    expect(recordRunItem.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
