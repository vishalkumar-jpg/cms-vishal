import { describe, expect, mock, test } from "bun:test";
import { ValidationPipe } from "@nestjs/common";
import type { PageRow } from "@database/schema";
import type { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { TenantContext } from "@common/tenancy/tenant-context";
import type { NotificationsService } from "@modules/notifications/notifications.service";
import type { QueueService } from "@modules/queue/queue.service";
import type { RedirectsService } from "@modules/redirects/redirects.service";
import type { WebhooksEmitter } from "@modules/webhooks/webhooks-emitter.service";
import { CreatePageDto, UpdatePageDto } from "../dto/page.dto";
import {
  provenanceColumnsFrom,
  type PageTemplateProvenance,
} from "../page-template-provenance";
import { PagesService } from "../pages.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@example.com",
  isPlatformAdmin: false,
};

const provenance: PageTemplateProvenance = {
  sourceTemplateId: "tsk_test",
  sourceTemplateKey: "tpl-marketing-home",
  sourceTemplateVersion: "1.2.0",
  instantiatedAt: new Date("2026-08-03T12:00:00.000Z"),
};

function sourceWithProvenance(overrides: Partial<PageRow> = {}): PageRow {
  return {
    id: "pag_src",
    siteId: "site_test",
    title: "Landing",
    slug: "landing",
    locale: "en",
    translationKey: "pag_src",
    status: "draft",
    workflowState: "draft",
    reviewerId: null,
    reviewNote: null,
    submittedAt: null,
    reviewedAt: null,
    draftLayout: null,
    publishedLayout: null,
    seo: {},
    layoutOptions: {},
    parentId: null,
    schemaVersion: "2.0",
    scheduledAt: null,
    publishedAt: null,
    expiresAt: null,
    previewToken: null,
    sourceTemplateId: provenance.sourceTemplateId,
    sourceTemplateKey: provenance.sourceTemplateKey,
    sourceTemplateVersion: provenance.sourceTemplateVersion,
    instantiatedAt: provenance.instantiatedAt,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    ...overrides,
  } as PageRow;
}

describe("provenanceColumnsFrom", () => {
  test("copies nullable provenance fields from a source page", () => {
    expect(provenanceColumnsFrom(provenance)).toEqual({
      sourceTemplateId: provenance.sourceTemplateId,
      sourceTemplateKey: provenance.sourceTemplateKey,
      sourceTemplateVersion: provenance.sourceTemplateVersion,
      instantiatedAt: provenance.instantiatedAt,
    });
  });

  test("preserves null provenance", () => {
    expect(
      provenanceColumnsFrom({
        sourceTemplateId: null,
        sourceTemplateKey: null,
        sourceTemplateVersion: null,
        instantiatedAt: null,
      }),
    ).toEqual({
      sourceTemplateId: null,
      sourceTemplateKey: null,
      sourceTemplateVersion: null,
      instantiatedAt: null,
    });
  });
});

describe("CreatePageDto / UpdatePageDto provenance immutability", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  test("strips provenance fields from UpdatePageDto", async () => {
    const dto = await pipe.transform(
      {
        title: "Renamed",
        sourceTemplateId: "tsk_hack",
        sourceTemplateKey: "tpl-hack",
        sourceTemplateVersion: "9.9.9",
        instantiatedAt: "2026-01-01T00:00:00.000Z",
      },
      { type: "body", metatype: UpdatePageDto },
    );
    expect(dto).toEqual({ title: "Renamed" });
    expect(dto).not.toHaveProperty("sourceTemplateId");
    expect(dto).not.toHaveProperty("sourceTemplateKey");
    expect(dto).not.toHaveProperty("sourceTemplateVersion");
    expect(dto).not.toHaveProperty("instantiatedAt");
  });

  test("strips provenance fields from CreatePageDto", async () => {
    const dto = await pipe.transform(
      {
        title: "Blank",
        slug: "blank",
        sourceTemplateId: "tsk_hack",
        sourceTemplateKey: "tpl-hack",
        sourceTemplateVersion: "9.9.9",
        instantiatedAt: "2026-01-01T00:00:00.000Z",
      },
      { type: "body", metatype: CreatePageDto },
    );
    expect(dto).toEqual({ title: "Blank", slug: "blank" });
    expect(dto).not.toHaveProperty("sourceTemplateId");
  });
});

describe("PagesService provenance persistence", () => {
  function setup(selectQueue: unknown[][]) {
    const inserts: Record<string, unknown>[] = [];
    let selectIdx = 0;

    const asWhereChain = (rows: unknown[]) => ({
      limit: async (n: number) => rows.slice(0, n),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    });

    const db = {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => {
            const rows = selectQueue[selectIdx] ?? [];
            selectIdx += 1;
            return asWhereChain(rows);
          }),
        })),
      })),
      insert: mock(() => ({
        values: mock((values: Record<string, unknown>) => {
          inserts.push(values);
          const row = {
            id: `pag_${inserts.length}`,
            siteId: "site_test",
            ...values,
          } as PageRow;
          return { returning: mock(async () => [row]) };
        }),
      })),
      update: mock(() => ({
        set: mock((values: Record<string, unknown>) => ({
          where: mock(() => ({
            returning: mock(async () => {
              const base = inserts[inserts.length - 1] ?? {};
              return [{ id: "pag_1", siteId: "site_test", ...base, ...values } as PageRow];
            }),
          })),
        })),
      })),
    };

    const repo = {
      siteId: "site_test",
      db,
      insertDefaults: () => ({ id: `pag_${inserts.length + 1}` }),
      scope: (_table: unknown, ...conds: unknown[]) => conds[0] ?? true,
    };

    const service = new PagesService(
      repo as unknown as ScopedRepository,
      { record: mock(async () => undefined) } as unknown as AuditService,
      { enqueueCachePurge: mock(async () => undefined) } as unknown as QueueService,
      {} as unknown as RedirectsService,
      { userId: actor.userId, requireSiteId: () => "site_test" } as unknown as TenantContext,
      {} as unknown as WebhooksEmitter,
      {} as unknown as NotificationsService,
    );

    return { service, inserts };
  }

  test("normal create leaves provenance NULL", async () => {
    // siteLocales → []; assertSlugFree → []
    const { service, inserts } = setup([[], []]);
    await service.create({ title: "Home", slug: "home-page" }, actor);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sourceTemplateId).toBeNull();
    expect(inserts[0].sourceTemplateKey).toBeNull();
    expect(inserts[0].sourceTemplateVersion).toBeNull();
    expect(inserts[0].instantiatedAt).toBeNull();
  });

  test("create with internal provenance persists all four fields", async () => {
    const { service, inserts } = setup([[], []]);
    await service.create({ title: "Landing", slug: "landing" }, actor, { provenance });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sourceTemplateId).toBe(provenance.sourceTemplateId);
    expect(inserts[0].sourceTemplateKey).toBe(provenance.sourceTemplateKey);
    expect(inserts[0].sourceTemplateVersion).toBe(provenance.sourceTemplateVersion);
    expect(inserts[0].instantiatedAt).toBe(provenance.instantiatedAt);
  });

  test("create with HubSpot source identity persists linkage on initial insert", async () => {
    const { service, inserts } = setup([[], []]);
    await service.create({ title: "About", slug: "about" }, actor, {
      hubspotSourceIdentity: {
        hubspotConnectionId: "ccn_test",
        hubspotKind: "page",
        hubspotHsId: "hs-1",
      },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].hubspotConnectionId).toBe("ccn_test");
    expect(inserts[0].hubspotKind).toBe("page");
    expect(inserts[0].hubspotHsId).toBe("hs-1");
  });

  test("duplicate copies provenance", async () => {
    const source = sourceWithProvenance();
    // get → source; nextCopySlug slug check → []
    const { service, inserts } = setup([[source], []]);
    await service.duplicate("pag_src", actor);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sourceTemplateId).toBe(provenance.sourceTemplateId);
    expect(inserts[0].sourceTemplateKey).toBe(provenance.sourceTemplateKey);
    expect(inserts[0].sourceTemplateVersion).toBe(provenance.sourceTemplateVersion);
    expect(inserts[0].instantiatedAt).toBe(provenance.instantiatedAt);
  });

  test("createTranslation copies provenance", async () => {
    const source = sourceWithProvenance();
    // get → source
    // siteLocales → en+es
    // siblings → []
    // assertSlugFree → []
    const { service, inserts } = setup([
      [source],
      [{ defaultLocale: "en", locales: ["en", "es"] }],
      [],
      [],
    ]);
    await service.createTranslation("pag_src", { locale: "es" }, actor);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sourceTemplateId).toBe(provenance.sourceTemplateId);
    expect(inserts[0].sourceTemplateKey).toBe(provenance.sourceTemplateKey);
    expect(inserts[0].sourceTemplateVersion).toBe(provenance.sourceTemplateVersion);
    expect(inserts[0].instantiatedAt).toBe(provenance.instantiatedAt);
    expect(inserts[0].locale).toBe("es");
  });
});
