import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HubspotRawContent, HubspotUniversalPage } from "@ob-cms/block-schema";
import type { PostRow } from "@database/schema";
import * as blockSchemaActual from "../../../../../../packages/block-schema/src/index.ts";
import { createMockHubspotAssetMigration } from "./hubspot-import-test-helpers";

const hubspotScopedImportFromUpmSpy = mock(
  (_upm: HubspotUniversalPage, _raw: HubspotRawContent, _options?: { assetUrlMap?: Record<string, string> }) => {
    throw new Error("hubspotScopedImportFromUpm spy not wired");
  },
);

mock.module("@ob-cms/block-schema", () => ({
  ...blockSchemaActual,
  hubspotScopedImportFromUpm: (
    upm: HubspotUniversalPage,
    raw: HubspotRawContent,
    options?: { assetUrlMap?: Record<string, string> },
  ) => {
    hubspotScopedImportFromUpmSpy(upm, raw, options);
    return blockSchemaActual.hubspotScopedImportFromUpm(upm, raw, options);
  },
}));

const {
  EMBED_BLOCK,
  GROUP_BLOCK,
  HUBSPOT_BLOG_POST_LIST_PATH,
  HUBSPOT_CONTENT_KIND_BLOG_POST,
  HUBSPOT_OB_SANDBOX_PORTAL_ID,
  HUBSPOT_PORTAL_INFO_API_PATH,
  HUBSPOT_PUBLISHED_STATE,
  SECTION_BLOCK,
  hubspotBlogPostGetPath,
  hubspotPageGetPath,
  hubspotPageListPath,
  normalizeHubspotContent,
} = await import("@ob-cms/block-schema");

const { HubspotImportService } = await import("../hubspot-import.service");

const HUBSPOT_ALLOWED_PORTAL_IDS_ENV = "HUBSPOT_ALLOWED_PORTAL_IDS";
const HUBSPOT_ALLOWED_PORTAL_ID_ENV = "HUBSPOT_ALLOWED_PORTAL_ID";

const SITE_PAGE_LIST = hubspotPageListPath("page");
const LANDING_PAGE_LIST = hubspotPageListPath("landing_page");

const actor = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

const CONNECTION_ID = "ccn_upm";
const RUN_ID = "imr_upm";

const layoutFixture = JSON.parse(
  readFileSync(
    join(
      import.meta.dir,
      "../../../../../../packages/block-schema/src/__tests__/fixtures/hubspot/layout-sections-module.json",
    ),
    "utf8",
  ),
) as HubspotRawContent;

const unmappedFixture = JSON.parse(
  readFileSync(
    join(
      import.meta.dir,
      "../../../../../../packages/block-schema/src/__tests__/fixtures/hubspot/unmapped-top-level.json",
    ),
    "utf8",
  ),
) as HubspotRawContent;

function embedHtmlFromCreateArg(dto: { draftLayout?: Record<string, unknown> }): string {
  const layout = dto.draftLayout as { nodes?: Record<string, { props?: { html?: string } }> };
  const embed = Object.values(layout.nodes ?? {}).find((n) => n.props?.html !== undefined);
  return embed?.props?.html ?? "";
}

function resolvedNamesFromLayout(
  layout: Record<string, unknown> | undefined,
): string[] {
  const nodes = (layout as { nodes?: Record<string, { type?: { resolvedName?: string } }> })
    ?.nodes;
  return Object.values(nodes ?? {}).map((n) => n.type?.resolvedName ?? "");
}

function assertStructuralLayoutWithoutEmbed(layout: Record<string, unknown> | undefined): void {
  const names = resolvedNamesFromLayout(layout);
  expect(names).toContain(SECTION_BLOCK);
  expect(names).toContain(GROUP_BLOCK);
  expect(names.filter((n) => n === EMBED_BLOCK).length).toBe(0);
}

function createServiceMocks(options?: { existingPosts?: PostRow[] }) {
  let pageCreateArg: { draftLayout?: Record<string, unknown> } | undefined;
  let postCreateArg: { layout?: Record<string, unknown> } | undefined;
  let postUpdateArg: { layout?: Record<string, unknown> } | undefined;

  const pagesCreate = mock(
    async (dto: { draftLayout?: Record<string, unknown> }, _actor: unknown) => {
      pageCreateArg = dto;
      return { id: "pg_upm", title: "Services", slug: "services", status: "draft" };
    },
  );
  const pagesPublish = mock(async () => ({ id: "pg_upm", status: "published" }));
  const pages = {
    create: pagesCreate,
    publish: pagesPublish,
    saveDraft: mock(async () => ({ id: "pg_upm", status: "draft" })),
    update: mock(async () => ({ id: "pg_upm", status: "draft" })),
    list: mock(async () => []),
  } as unknown as import("@modules/pages/pages.service").PagesService;

  const blogCreate = mock(async (dto: { layout?: Record<string, unknown> }) => {
    postCreateArg = dto;
    return { id: "post_upm", title: "Blog", slug: "blog", status: "draft" };
  });
  const blogUpdate = mock(
    async (_id: string, dto: { layout?: Record<string, unknown> }) => {
      postUpdateArg = dto;
      return { id: "post_upm", title: "Blog", slug: "blog", status: "draft" };
    },
  );
  const blog = {
    create: blogCreate,
    publish: mock(async () => ({ id: "post_upm", status: "published" })),
    update: blogUpdate,
    list: mock(async () => []),
  } as unknown as import("@modules/blog/blog.service").BlogService;

  const auditRecord = mock(async () => undefined);
  const audit = {
    record: auditRecord,
  } as unknown as import("@common/audit/audit.service").AuditService;
  const importRuns = {
    recordRunItem: mock(async () => undefined),
  } as unknown as import("@modules/connectors/import-runs.service").ImportRunsService;

  const repo = {
    siteId: "site_test",
    insertDefaults: () => ({ siteId: "site_test" }),
    scope: (_table: unknown, ...conditions: unknown[]) => conditions,
    db: {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(async () => options?.existingPosts ?? []),
          })),
        })),
      })),
    },
  } as unknown as import("@common/tenancy/scoped-repository").ScopedRepository;

  const assetMigration = createMockHubspotAssetMigration();
  const service = new HubspotImportService(repo, audit, pages, blog, importRuns, assetMigration);
  return {
    service,
    pagesCreate,
    blogCreate,
    blogUpdate,
    auditRecord,
    getPageCreateArg: () => pageCreateArg,
    getPostCreateArg: () => postCreateArg,
    getPostUpdateArg: () => postUpdateArg,
  };
}

const postStructuralRaw: HubspotRawContent = {
  ...layoutFixture,
  id: "post-9",
  name: "Launch",
  slug: "launch",
  state: "DRAFT",
};

function mockFetchStructuralBlogPost(): typeof fetch {
  return mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
      return new Response(JSON.stringify({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }), {
        status: 200,
      });
    }
    if (url.includes(SITE_PAGE_LIST) && !url.includes(`${SITE_PAGE_LIST}/`)) {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    if (url.includes(LANDING_PAGE_LIST)) {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    if (url.includes(hubspotBlogPostGetPath("post-9"))) {
      return new Response(JSON.stringify(postStructuralRaw), { status: 200 });
    }
    if (
      url.includes(HUBSPOT_BLOG_POST_LIST_PATH) &&
      !url.includes(`${HUBSPOT_BLOG_POST_LIST_PATH}/`)
    ) {
      return new Response(
        JSON.stringify({
          results: [{ id: "post-9", name: "Launch", slug: "launch", state: "DRAFT" }],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  });
}

describe("HubspotImportService scoped UPM wiring", () => {
  const originalFetch = globalThis.fetch;
  const originalPlural = process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
  const originalEnv = process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];

  beforeEach(() => {
    delete process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
    delete process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];
    hubspotScopedImportFromUpmSpy.mockReset();
    hubspotScopedImportFromUpmSpy.mockImplementation(blockSchemaActual.hubspotScopedImportFromUpm);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalPlural === undefined) delete process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV];
    else process.env[HUBSPOT_ALLOWED_PORTAL_IDS_ENV] = originalPlural;
    if (originalEnv === undefined) delete process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV];
    else process.env[HUBSPOT_ALLOWED_PORTAL_ID_ENV] = originalEnv;
  });

  afterAll(() => {
    mock.restore();
  });

  test("scoped page import uses Phase D layout conversion with embed fallback unavailable", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
        return new Response(JSON.stringify({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }), {
          status: 200,
        });
      }
      if (url.includes(SITE_PAGE_LIST) && !url.includes(`${SITE_PAGE_LIST}/`)) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "3003",
                name: "Services",
                slug: "services",
                state: HUBSPOT_PUBLISHED_STATE,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes(LANDING_PAGE_LIST)) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes(hubspotPageGetPath("page", "3003"))) {
        return new Response(JSON.stringify(layoutFixture), { status: 200 });
      }
      if (url.includes(HUBSPOT_BLOG_POST_LIST_PATH)) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });

    const { service, getPageCreateArg, auditRecord } = createServiceMocks();
    await service.runScoped("token", "published", actor, {
      connectionId: CONNECTION_ID,
      runId: RUN_ID,
    });

    expect(hubspotScopedImportFromUpmSpy).toHaveBeenCalledTimes(1);
    const [upmArg, rawArg, optionsArg] = hubspotScopedImportFromUpmSpy.mock.calls[0] as [
      HubspotUniversalPage,
      HubspotRawContent,
      { assetUrlMap?: Record<string, string> },
    ];
    expect(rawArg).toEqual(layoutFixture);
    expect(upmArg.source.hsId).toBe("3003");
    expect(upmArg.source.kind).toBe("page");
    expect(typeof upmArg.source.extractedAtIso).toBe("string");
    expect(upmArg.source.extractedAtIso.length).toBeGreaterThan(0);
    expect(optionsArg?.assetUrlMap).toEqual({});

    const createArg = getPageCreateArg();
    expect(createArg).toBeDefined();
    const draftLayout = createArg!.draftLayout as {
      nodes?: Record<string, { type?: { resolvedName?: string } }>;
    };
    const names = Object.values(draftLayout.nodes ?? {}).map((n) => n.type?.resolvedName);
    expect(names).toContain(SECTION_BLOCK);
    expect(names).toContain(GROUP_BLOCK);
    expect(names.filter((n) => n === EMBED_BLOCK).length).toBe(0);

    const auditPayload = auditRecord.mock.calls[0]?.[0] as {
      metadata?: {
        conversionItems?: {
          hubspotHsId: string;
          hasStructuralLayout: boolean;
          diagnostics: { code: string }[];
        }[];
      };
    };
    const pageConversion = auditPayload.metadata?.conversionItems?.find(
      (item) => item.hubspotHsId === "3003",
    );
    expect(pageConversion?.hasStructuralLayout).toBe(true);
    expect(pageConversion?.diagnostics.some((d) => d.code === "LAYOUT_MODULE_DEFERRED")).toBe(
      true,
    );
  });

  test("scoped post import uses structural layout on create and update", async () => {
    globalThis.fetch = mockFetchStructuralBlogPost();

    const { service, blogCreate, getPostCreateArg } = createServiceMocks();
    await service.runScoped("token", "all", actor, { connectionId: CONNECTION_ID });

    expect(hubspotScopedImportFromUpmSpy).toHaveBeenCalledTimes(1);
    const [upmArg, rawArg] = hubspotScopedImportFromUpmSpy.mock.calls[0] as [
      HubspotUniversalPage,
      HubspotRawContent,
    ];
    expect(rawArg).toEqual(postStructuralRaw);
    expect(upmArg.source.kind).toBe(HUBSPOT_CONTENT_KIND_BLOG_POST);
    expect(upmArg.source.hsId).toBe("post-9");

    expect(blogCreate).toHaveBeenCalledTimes(1);
    const createLayout = getPostCreateArg()?.layout;
    assertStructuralLayoutWithoutEmbed(createLayout);

    hubspotScopedImportFromUpmSpy.mockClear();

    const existingPost = {
      id: "post_existing",
      siteId: "site_test",
      title: "Launch",
      slug: "launch",
      locale: "en",
      status: "draft",
      workflowState: "draft",
      seo: {},
      hubspotConnectionId: CONNECTION_ID,
      hubspotKind: HUBSPOT_CONTENT_KIND_BLOG_POST,
      hubspotHsId: "post-9",
    } as PostRow;

    const {
      service: updateService,
      blogCreate: blogCreateSecond,
      blogUpdate,
      getPostUpdateArg,
      auditRecord,
    } = createServiceMocks({ existingPosts: [existingPost] });

    await updateService.runScoped("token", "all", actor, { connectionId: CONNECTION_ID });

    expect(blogCreateSecond).not.toHaveBeenCalled();
    expect(blogUpdate).toHaveBeenCalledTimes(1);
    assertStructuralLayoutWithoutEmbed(getPostUpdateArg()?.layout);
    expect(resolvedNamesFromLayout(createLayout)).toEqual(
      resolvedNamesFromLayout(getPostUpdateArg()?.layout),
    );

    const auditPayload = auditRecord.mock.calls[0]?.[0] as {
      metadata?: {
        conversionItems?: {
          hubspotHsId: string;
          diagnostics: { code: string }[];
        }[];
      };
    };
    const postConversion = auditPayload.metadata?.conversionItems?.find(
      (item) => item.hubspotHsId === "post-9",
    );
    expect(postConversion?.diagnostics.some((d) => d.code === "LAYOUT_MODULE_DEFERRED")).toBe(
      true,
    );
  });

  test("scoped import succeeds when HubSpot payload has unmapped top-level fields", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(HUBSPOT_PORTAL_INFO_API_PATH)) {
        return new Response(JSON.stringify({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }), {
          status: 200,
        });
      }
      if (url.includes(SITE_PAGE_LIST) && !url.includes(`${SITE_PAGE_LIST}/`)) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "5005",
                name: "Extra fields",
                slug: "extra",
                state: HUBSPOT_PUBLISHED_STATE,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes(LANDING_PAGE_LIST)) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes(hubspotPageGetPath("page", "5005"))) {
        return new Response(JSON.stringify(unmappedFixture), { status: 200 });
      }
      if (url.includes(HUBSPOT_BLOG_POST_LIST_PATH)) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });

    const { service, pagesCreate, getPageCreateArg } = createServiceMocks();
    const summary = await service.runScoped("token", "published", actor, {
      connectionId: CONNECTION_ID,
    });
    expect(summary.importedPages).toBe(1);
    expect(pagesCreate).toHaveBeenCalledTimes(1);
    expect(hubspotScopedImportFromUpmSpy).toHaveBeenCalled();
    expect(embedHtmlFromCreateArg(getPageCreateArg()!)).toBe(
      normalizeHubspotContent(unmappedFixture).html,
    );
  });
});
