import { describe, expect, mock, test } from "bun:test";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { emptyLayout, type SerializedLayout } from "@ob-cms/block-schema";
import {
  SKELETON_CONTENT_SCHEMA_VERSION,
  type TemplateSkeletonRecord,
} from "@ob-cms/template-registry";
import type { PageRow } from "@database/schema";
import type { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { TenantContext } from "@common/tenancy/tenant-context";
import type { TemplateSkeletonsService } from "@modules/template-skeletons/template-skeletons.service";
import type { PagesService } from "../pages.service";
import { TemplateInstantiationService } from "../template-instantiation.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@example.com",
  isPlatformAdmin: false,
};

const page = {
  id: "pag_created",
  siteId: "site_test",
  title: "Landing",
  slug: "landing",
  status: "draft",
} as PageRow;

function skeleton(
  status: "draft" | "published" | "archived" = "published",
): TemplateSkeletonRecord {
  return {
    metadata: {
      id: "tsk_test",
      templateKey: "tpl-test",
      displayName: "Test",
      description: "Test template",
      category: "marketing",
      supportedPageTypes: ["landing"],
      tags: [],
      previewMetadata: {},
      version: "1.0.0",
      status,
      schemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    },
    content: {
      contentSchemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
      layout: emptyLayout(),
      sections: [],
      pageStructure: {
        defaultSectionOrder: [],
        requiredSectionIds: [],
        optionalSectionIds: [],
      },
      componentProps: {},
    },
  };
}

function setup(record: TemplateSkeletonRecord = skeleton()) {
  const skeletons = {
    getById: mock(async () => record),
    getByKey: mock(async () => record),
  };
  const pages = { create: mock(async () => page) };
  const audit = { record: mock(async () => undefined) };
  const ctx = { requireSiteId: mock(() => "site_test") };
  const service = new TemplateInstantiationService(
    skeletons as unknown as TemplateSkeletonsService,
    pages as unknown as PagesService,
    audit as unknown as AuditService,
    ctx as unknown as TenantContext,
  );
  return { service, skeletons, pages, audit };
}

const input = { title: "Landing", slug: "landing", templateKey: "tpl-test" };

describe("TemplateInstantiationService", () => {
  test("resolves by templateKey and creates an independent draft layout", async () => {
    const source = skeleton();
    const { service, skeletons, pages, audit } = setup(source);

    const result = await service.instantiate(input, actor);

    expect(result).toBe(page);
    expect(skeletons.getByKey).toHaveBeenCalledWith("tpl-test");
    expect(skeletons.getById).not.toHaveBeenCalled();
    expect(pages.create).toHaveBeenCalledTimes(1);

    const createCall = (pages.create as ReturnType<typeof mock>).mock.calls[0];
    const createInput = createCall[0];
    const createOptions = createCall[2];
    expect(createInput.draftLayout).toEqual(source.content.layout);
    expect(createInput.draftLayout).not.toBe(source.content.layout);
    const copiedLayout = createInput.draftLayout as SerializedLayout;
    copiedLayout.nodes.ROOT.props.changed = true;
    expect((source.content.layout as unknown as SerializedLayout).nodes.ROOT.props.changed).toBe(
      undefined,
    );
    expect(createOptions.provenance).toEqual(
      expect.objectContaining({
        sourceTemplateId: "tsk_test",
        sourceTemplateKey: "tpl-test",
        sourceTemplateVersion: "1.0.0",
      }),
    );
    expect(createOptions.provenance.instantiatedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "site_test",
        action: "page.created_from_template",
        entityId: page.id,
        metadata: expect.objectContaining({
          skeletonId: "tsk_test",
          templateKey: "tpl-test",
        }),
      }),
    );
  });

  test("resolves by skeletonId", async () => {
    const { service, skeletons } = setup();

    await service.instantiate(
      { title: "Landing", slug: "landing", skeletonId: "tsk_test" },
      actor,
    );

    expect(skeletons.getById).toHaveBeenCalledWith("tsk_test");
    expect(skeletons.getByKey).not.toHaveBeenCalled();
  });

  test("requires exactly one skeleton reference", async () => {
    const { service, pages } = setup();

    await expect(
      service.instantiate({ title: "Landing", slug: "landing" }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.instantiate(
        { ...input, skeletonId: "tsk_test" },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pages.create).not.toHaveBeenCalled();
  });

  test("propagates missing skeleton NotFound without creating a page", async () => {
    const { service, skeletons, pages, audit } = setup();
    (skeletons.getByKey as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new NotFoundException("Template skeleton not found");
    });

    await expect(service.instantiate(input, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(pages.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  test.each(["draft", "archived"] as const)("rejects %s skeletons", async (status) => {
    const { service, pages } = setup(skeleton(status));

    await expect(service.instantiate(input, actor)).rejects.toThrow(
      "Template skeleton must be published",
    );
    expect(pages.create).not.toHaveBeenCalled();
  });

  test("rejects a template layout that cannot be copied", async () => {
    const record = skeleton();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    record.content.layout = cyclic;
    const { service, pages } = setup(record);

    await expect(service.instantiate(input, actor)).rejects.toThrow("Invalid template layout");
    expect(pages.create).not.toHaveBeenCalled();
  });

  test("propagates reserved root slug errors without writing instantiation audit", async () => {
    const { service, pages, audit } = setup();
    (pages.create as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new BadRequestException("Reserved root slug");
    });

    await expect(service.instantiate(input, actor)).rejects.toThrow("Reserved root slug");
    expect(audit.record).not.toHaveBeenCalled();
  });

  test("returns the created page when audit recording fails", async () => {
    const { service, pages, audit } = setup();
    (audit.record as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error("audit log unavailable");
    });

    await expect(service.instantiate(input, actor)).resolves.toBe(page);
    expect(pages.create).toHaveBeenCalledTimes(1);
  });

  test("returns the created page when audit rejects with a non-Error value", async () => {
    const { service, pages, audit } = setup();
    (audit.record as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw null;
    });

    await expect(service.instantiate(input, actor)).resolves.toBe(page);
    expect(pages.create).toHaveBeenCalledTimes(1);
  });

  test("propagates duplicate slug conflicts without writing instantiation audit", async () => {
    const { service, pages, audit } = setup();
    (pages.create as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new ConflictException("A page with slug landing already exists");
    });

    await expect(service.instantiate(input, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
