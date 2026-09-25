import { describe, expect, mock, test } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { emptyLayout, type SerializedLayout } from "@ob-cms/block-schema";
import type { CollectionRow } from "@database/schema";
import type { AuditService } from "@common/audit/audit.service";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { QueueService } from "@modules/queue/queue.service";
import { CollectionsService } from "../collections.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@example.com",
  isPlatformAdmin: false,
};

const baseCollection = {
  id: "col_1",
  siteId: "site_test",
  name: "Case Studies",
  slug: "case-studies",
  fields: [],
  detailLayout: null,
} as CollectionRow;

function setup(selectQueue: unknown[][], opts?: { emptyUpdate?: boolean }) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let selectIdx = 0;

  const asWhereChain = (rows: unknown[]) => ({
    limit: async (n: number) => rows.slice(0, n),
    orderBy: () => asWhereChain(rows),
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
          id: `col_${inserts.length}`,
          siteId: "site_test",
          ...values,
        } as CollectionRow;
        return { returning: mock(async () => [row]) };
      }),
    })),
    update: mock(() => ({
      set: mock((values: Record<string, unknown>) => {
        updates.push(values);
        return {
          where: mock(() => ({
            returning: mock(async () =>
              opts?.emptyUpdate
                ? []
                : [{ ...baseCollection, ...values } as CollectionRow],
            ),
          })),
        };
      }),
    })),
  };

  const repo = {
    siteId: "site_test",
    db,
    insertDefaults: () => ({
      id: `col_${inserts.length + 1}`,
      siteId: "site_test",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    }),
    scope: (_table: unknown, ...conds: unknown[]) => conds[0] ?? true,
  };

  const purge = mock(async () => undefined);

  const service = new CollectionsService(
    repo as unknown as ScopedRepository,
    { record: mock(async () => undefined) } as unknown as AuditService,
    { enqueueCachePurge: purge } as unknown as QueueService,
  );

  return { service, inserts, updates, purge };
}

describe("CollectionsService detailLayout persistence", () => {
  test("create without detailLayout persists null", async () => {
    // assertSlugFree → []; assertNameFree → []
    const { service, inserts } = setup([[], []]);
    await service.create({ name: "Case Studies", slug: "case-studies" }, actor);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].detailLayout).toBeNull();
  });

  test("create with valid detailLayout persists validated layout", async () => {
    const layout = emptyLayout();
    const { service, inserts } = setup([[], []]);
    await service.create(
      {
        name: "Case Studies",
        slug: "case-studies",
        detailLayout: layout as unknown as Record<string, unknown>,
      },
      actor,
    );
    expect(inserts).toHaveLength(1);
    const stored = inserts[0].detailLayout as SerializedLayout;
    expect(stored.root).toBe("ROOT");
    expect(stored.schemaVersion).toBe(layout.schemaVersion);
    expect(stored.nodes.ROOT).toBeDefined();
  });

  test("create rejects detailLayout that fails block-schema repair", async () => {
    const { service, inserts } = setup([[], []]);
    // ROOT: null trips repairLayout (same failure mode as pages.validateLayout).
    await expect(
      service.create(
        {
          name: "Case Studies",
          slug: "case-studies",
          detailLayout: {
            schemaVersion: "2.0",
            root: "ROOT",
            nodes: { ROOT: null },
          },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(inserts).toHaveLength(0);
  });

  test("update sets a valid detailLayout", async () => {
    const layout = emptyLayout();
    // get → existing; assertSlugFree/name unused
    const { service, updates } = setup([[baseCollection]]);
    const row = await service.update(
      "col_1",
      { detailLayout: layout as unknown as Record<string, unknown> },
      actor,
    );
    expect(updates).toHaveLength(1);
    expect((updates[0].detailLayout as SerializedLayout).root).toBe("ROOT");
    expect(row.detailLayout).toBeTruthy();
  });

  test("update with null clears detailLayout", async () => {
    const withLayout = {
      ...baseCollection,
      detailLayout: emptyLayout(),
    } as CollectionRow;
    const { service, updates } = setup([[withLayout]]);
    await service.update("col_1", { detailLayout: null }, actor);
    expect(updates).toHaveLength(1);
    expect(updates[0].detailLayout).toBeNull();
  });

  test("update rejects detailLayout that fails block-schema repair", async () => {
    const { service, updates } = setup([[baseCollection]]);
    await expect(
      service.update(
        "col_1",
        {
          detailLayout: {
            schemaVersion: "2.0",
            root: "ROOT",
            nodes: { ROOT: null },
          },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updates).toHaveLength(0);
  });

  test("update without detailLayout leaves layout unchanged in patch", async () => {
    const { service, updates } = setup([[baseCollection]]);
    await service.update("col_1", { name: "Case Studies Renamed" }, actor);
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty("detailLayout");
    expect(updates[0].name).toBe("Case Studies Renamed");
  });
});

describe("CollectionsService saveDetailLayout", () => {
  test("persists a valid detailLayout without touching other fields", async () => {
    const layout = emptyLayout();
    const { service, updates } = setup([[baseCollection]]);
    const row = await service.saveDetailLayout(
      "col_1",
      { detailLayout: layout as unknown as Record<string, unknown> },
      actor,
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      detailLayout: expect.objectContaining({ root: "ROOT" }),
      updatedBy: actor.userId,
    });
    expect(updates[0]).not.toHaveProperty("name");
    expect(updates[0]).not.toHaveProperty("fields");
    expect(row.detailLayout).toBeTruthy();
  });

  test("clears detailLayout when null is sent", async () => {
    const withLayout = {
      ...baseCollection,
      detailLayout: emptyLayout(),
    } as CollectionRow;
    const { service, updates, purge } = setup([[withLayout]]);
    await service.saveDetailLayout("col_1", { detailLayout: null }, actor);
    expect(updates[0].detailLayout).toBeNull();
    expect(updates[0].updatedBy).toBe(actor.userId);
    expect(purge).toHaveBeenCalledTimes(1);
  });

  test("throws NotFoundException when collection is deleted before save", async () => {
    const layout = emptyLayout();
    const { service, updates, purge } = setup([[baseCollection]], { emptyUpdate: true });
    await expect(
      service.saveDetailLayout(
        "col_1",
        { detailLayout: layout as unknown as Record<string, unknown> },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updates).toHaveLength(1);
    expect(purge).not.toHaveBeenCalled();
  });

  test("rejects undefined detailLayout", async () => {
    const { service, updates } = setup([[baseCollection]]);
    await expect(
      service.saveDetailLayout("col_1", { detailLayout: undefined } as never, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updates).toHaveLength(0);
  });

  test("rejects invalid detailLayout", async () => {
    const { service, updates } = setup([[baseCollection]]);
    await expect(
      service.saveDetailLayout(
        "col_1",
        {
          detailLayout: {
            schemaVersion: "2.0",
            root: "ROOT",
            nodes: { ROOT: null },
          },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updates).toHaveLength(0);
  });

  test("enqueues cache purge for the collection slug", async () => {
    const layout = emptyLayout();
    const { service, purge } = setup([[baseCollection]]);
    await service.saveDetailLayout(
      "col_1",
      { detailLayout: layout as unknown as Record<string, unknown> },
      actor,
    );
    expect(purge).toHaveBeenCalledTimes(1);
    expect(purge.mock.calls[0]?.[0]).toEqual({
      siteId: "site_test",
      entity: "collection",
      entityId: "case-studies",
      slug: "/",
    });
  });
});
