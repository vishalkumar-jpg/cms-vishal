import { describe, expect, mock, test } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { emptyLayout } from "@ob-cms/block-schema";
import type { PageTemplateRow } from "@database/schema";
import type { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { TenantContext } from "@common/tenancy/tenant-context";
import { TemplatesService } from "../templates.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@example.com",
  isPlatformAdmin: false,
};

const ACTIVE_SITE_ID = "site_test";

const baseTemplate = {
  id: "tpl_site_1",
  siteId: ACTIVE_SITE_ID,
  name: "Hero block",
  kind: "section",
  layout: emptyLayout(),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  createdBy: actor.userId,
  updatedBy: actor.userId,
} as PageTemplateRow;

const globalPreset = {
  ...baseTemplate,
  id: "tpl_global",
  siteId: null,
} as PageTemplateRow;

const foreignSiteTemplate = {
  ...baseTemplate,
  id: "tpl_foreign",
  siteId: "site_other",
} as PageTemplateRow;

const deletedTemplate = {
  ...baseTemplate,
  id: "tpl_deleted",
  deletedAt: new Date("2026-01-02T00:00:00.000Z"),
} as PageTemplateRow;

/** Mirrors ScopedRepository.scope: active site + not soft-deleted. */
const isTenantScopedRow = (row: PageTemplateRow): boolean =>
  row.siteId === ACTIVE_SITE_ID && row.deletedAt === null;

function setup(opts?: {
  fixtures?: PageTemplateRow[];
  targetId?: string;
  missingUpdate?: boolean;
}) {
  const auditCalls: unknown[] = [];
  let auditTx: unknown;
  const fixtures = opts?.fixtures ?? [baseTemplate];
  const targetId = opts?.targetId ?? baseTemplate.id;

  const scopedRows = (id: string): PageTemplateRow[] =>
    fixtures.filter((row) => row.id === id && isTenantScopedRow(row));

  const forUpdate = mock(async () => scopedRows(targetId));

  const tx = {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => ({
            for: forUpdate,
          })),
        })),
      })),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(async () => {
            if (opts?.missingUpdate) return [];
            const [row] = scopedRows(targetId);
            return row ? [{ ...row, name: "Renamed hero" }] : [];
          }),
        })),
      })),
    })),
  };

  const db = {
    transaction: mock(async (fn: (innerTx: typeof tx) => Promise<PageTemplateRow>) => fn(tx)),
  };

  const repo = {
    siteId: ACTIVE_SITE_ID,
    db,
    scope: (_table: unknown, ...conds: unknown[]) => conds[0] ?? true,
    insertDefaults: () => ({ siteId: ACTIVE_SITE_ID, createdBy: actor.userId }),
  };

  const service = new TemplatesService(
    repo as unknown as ScopedRepository,
    { requireSiteId: () => ACTIVE_SITE_ID } as unknown as TenantContext,
    {
      record: mock(async (entry: unknown, tx?: unknown) => {
        auditCalls.push(entry);
        auditTx = tx;
      }),
    } as unknown as AuditService,
  );

  return { service, auditCalls, getAuditTx: () => auditTx, tx, forUpdate };
}

describe("TemplatesService.update", () => {
  test("renames a site-owned template and records audit metadata in one transaction", async () => {
    const { service, auditCalls, getAuditTx, tx, forUpdate } = setup();
    const row = await service.update("tpl_site_1", { name: "  Renamed hero  " }, actor);
    expect(row.name).toBe("Renamed hero");
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      action: "template.renamed",
      entityId: "tpl_site_1",
      metadata: { oldName: "Hero block", newName: "Renamed hero" },
    });
    expect(getAuditTx()).toBe(tx);
    expect(forUpdate).toHaveBeenCalledWith("update");
  });

  test("throws when the sanitized name is empty", async () => {
    const { service, auditCalls } = setup();
    await expect(service.update("tpl_site_1", { name: "\u0000" }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(auditCalls).toHaveLength(0);
  });

  test("throws when the template is missing", async () => {
    const { service } = setup({ targetId: "tpl_missing" });
    await expect(service.update("tpl_missing", { name: "Nope" }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("throws when renaming a global preset", async () => {
    const { service } = setup({ fixtures: [globalPreset], targetId: "tpl_global" });
    await expect(service.update("tpl_global", { name: "Nope" }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("throws when renaming a foreign-site template", async () => {
    const { service } = setup({ fixtures: [foreignSiteTemplate], targetId: "tpl_foreign" });
    await expect(service.update("tpl_foreign", { name: "Nope" }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("throws when renaming a soft-deleted template", async () => {
    const { service } = setup({ fixtures: [deletedTemplate], targetId: "tpl_deleted" });
    await expect(service.update("tpl_deleted", { name: "Nope" }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("throws when the scoped update affects zero rows", async () => {
    const { service } = setup({ missingUpdate: true });
    await expect(service.update("tpl_site_1", { name: "Nope" }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
