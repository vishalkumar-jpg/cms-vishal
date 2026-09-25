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

const CONNECTION_ID = "ccn_import";
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

describe("HubspotImportService scoped create identity", () => {
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

  test("passes HubSpot identity into create; second run finds linked rows without extra linkage updates", async () => {
    globalThis.fetch = mockFetchPublishedPageAndPost();

    const linkedPages: PageRow[] = [];
    const linkedPosts: PostRow[] = [];
    let hubspotLinkageUpdates = 0;
    let lookupCall = 0;

    const pagesCreate = mock(
      async (
        _dto: unknown,
        _actor: unknown,
        options?: { hubspotSourceIdentity?: Record<string, string> },
      ) => {
        const identity = options?.hubspotSourceIdentity;
        expect(identity).toEqual({
          hubspotConnectionId: CONNECTION_ID,
          hubspotKind: "page",
          hubspotHsId: "page-1",
        });
        const row = {
          id: "pg_new",
          siteId: "site_test",
          hubspotConnectionId: identity?.hubspotConnectionId,
          hubspotKind: identity?.hubspotKind,
          hubspotHsId: identity?.hubspotHsId,
        } as PageRow;
        linkedPages.push(row);
        return row;
      },
    );

    const blogCreate = mock(
      async (
        _dto: unknown,
        _actor: unknown,
        options?: { hubspotSourceIdentity?: Record<string, string> },
      ) => {
        const identity = options?.hubspotSourceIdentity;
        expect(identity).toEqual({
          hubspotConnectionId: CONNECTION_ID,
          hubspotKind: HUBSPOT_CONTENT_KIND_BLOG_POST,
          hubspotHsId: "post-1",
        });
        const row = {
          id: "post_new",
          siteId: "site_test",
          hubspotConnectionId: identity?.hubspotConnectionId,
          hubspotKind: identity?.hubspotKind,
          hubspotHsId: identity?.hubspotHsId,
        } as PostRow;
        linkedPosts.push(row);
        return row;
      },
    );

    const pagesSaveDraft = mock(async (id: string) => ({ id, status: "draft" }));

    const pages = {
      create: pagesCreate,
      publish: mock(async () => ({ id: "pg_new", status: "published" })),
      saveDraft: pagesSaveDraft,
      update: mock(async (id: string) => ({ id, status: "draft" })),
      list: mock(async () => []),
    } as unknown as PagesService;

    const blog = {
      create: blogCreate,
      publish: mock(async () => ({ id: "post_new", status: "published" })),
      update: mock(async (id: string) => ({ id, status: "draft" })),
      list: mock(async () => []),
    } as unknown as BlogService;

    const repo = {
      siteId: "site_test",
      insertDefaults: () => ({ siteId: "site_test" }),
      scope: (_table: unknown, ...conditions: unknown[]) => conditions,
      db: {
        select: mock(() => ({
          from: mock(() => ({
            where: mock(() => ({
              limit: mock(async () => {
                lookupCall += 1;
                if (lookupCall % 2 === 1) {
                  return linkedPages.filter((p) => p.hubspotConnectionId === CONNECTION_ID);
                }
                return linkedPosts.filter((p) => p.hubspotConnectionId === CONNECTION_ID);
              }),
            })),
          })),
        })),
        update: mock(() => ({
          set: mock((values: Record<string, unknown>) => {
            if ("hubspotConnectionId" in values) hubspotLinkageUpdates += 1;
            return { where: mock(async () => undefined) };
          }),
        })),
      },
    } as unknown as ScopedRepository;

    const service = new HubspotImportService(
      repo,
      { record: mock(async () => undefined) } as unknown as AuditService,
      pages,
      blog,
      { recordRunItem: mock(async () => undefined) } as unknown as ImportRunsService,
      createMockHubspotAssetMigration(),
    );

    await service.runScoped("pat-test", "all", actor, {
      connectionId: CONNECTION_ID,
      runId: RUN_ID,
    });

    expect(pagesCreate).toHaveBeenCalledTimes(1);
    expect(blogCreate).toHaveBeenCalledTimes(1);
    expect(hubspotLinkageUpdates).toBe(0);

    await service.runScoped("pat-test", "all", actor, {
      connectionId: CONNECTION_ID,
      runId: RUN_ID,
    });

    expect(pagesCreate).toHaveBeenCalledTimes(1);
    expect(blogCreate).toHaveBeenCalledTimes(1);
    expect(pagesSaveDraft).toHaveBeenCalled();
    expect(hubspotLinkageUpdates).toBe(0);
  });
});
