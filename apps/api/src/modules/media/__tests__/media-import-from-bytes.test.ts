import { describe, expect, mock, test } from "bun:test";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { QueueService } from "@modules/queue/queue.service";
import type { StorageService } from "../storage.service";
import { MediaService } from "../media.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

function createMediaService(options: {
  insertThrows?: boolean;
  deleteThrows?: boolean;
  queueThrows?: boolean;
  auditThrows?: boolean;
}) {
  const putObject = mock(async () => undefined);
  const deleteObject = mock(async () => {
    if (options.deleteThrows) throw new Error("delete failed");
  });
  const storage = {
    buildKey: () => "sites/site_test/key.jpg",
    publicUrl: () => "https://media.ob/key.jpg",
    putObject,
    delete: deleteObject,
  } as unknown as StorageService;

  const insertReturning = mock(async () => {
    if (options.insertThrows) throw new Error("db insert failed");
    return [{ id: "med_1", storageKey: "sites/site_test/key.jpg", url: "https://media.ob/key.jpg" }];
  });

  const repo = {
    siteId: "site_test",
    insertDefaults: () => ({ siteId: "site_test", id: "med_1" }),
    scope: (...conditions: unknown[]) => conditions,
    db: {
      insert: mock(() => ({ values: mock(() => ({ returning: insertReturning })) })),
      update: mock(() => ({
        set: mock(() => ({ where: mock(async () => undefined) })),
      })),
    },
  } as unknown as ScopedRepository;

  const enqueueMediaProcess = mock(async () => {
    if (options.queueThrows) throw new Error("queue failed");
  });
  const queue = { enqueueMediaProcess } as unknown as QueueService;

  const record = mock(async () => {
    if (options.auditThrows) throw new Error("audit failed");
  });
  const audit = { record } as unknown as import("@common/audit/audit.service").AuditService;

  const service = new MediaService(repo, storage, audit, queue);
  return { service, repo, putObject, deleteObject, enqueueMediaProcess, record };
}

describe("MediaService.importFromBytes", () => {
  test("attempts blob cleanup when DB insert fails", async () => {
    const { service, deleteObject } = createMediaService({ insertThrows: true });
    await expect(
      service.importFromBytes(
        { filename: "a.jpg", contentType: "image/jpeg", body: Buffer.from([1]), byteSize: 1 },
        actor,
      ),
    ).rejects.toThrow("db insert failed");
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });

  test("preserves original failure when cleanup also fails", async () => {
    const { service } = createMediaService({ insertThrows: true, deleteThrows: true });
    await expect(
      service.importFromBytes(
        { filename: "a.jpg", contentType: "image/jpeg", body: Buffer.from([1]), byteSize: 1 },
        actor,
      ),
    ).rejects.toThrow(/db insert failed.*storage cleanup also failed/i);
  });

  test("marks the processing row failed when queueing fails after insert", async () => {
    const { service, repo, enqueueMediaProcess } = createMediaService({ queueThrows: true });
    const row = await service.importFromBytes(
      { filename: "a.jpg", contentType: "image/jpeg", body: Buffer.from([1]), byteSize: 1 },
      actor,
    );
    expect(row.id).toBe("med_1");
    expect(row.status).toBe("failed");
    expect(enqueueMediaProcess).toHaveBeenCalledTimes(1);
    expect(repo.db.update).toHaveBeenCalledTimes(1);
  });

  test("returns the inserted row when audit recording fails", async () => {
    const { service, record } = createMediaService({ auditThrows: true });
    const row = await service.importFromBytes(
      { filename: "a.jpg", contentType: "image/jpeg", body: Buffer.from([1]), byteSize: 1 },
      actor,
    );
    expect(row.id).toBe("med_1");
    expect(record).toHaveBeenCalledTimes(1);
  });
});
