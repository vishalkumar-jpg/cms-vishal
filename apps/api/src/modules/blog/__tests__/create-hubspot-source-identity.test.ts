import { describe, expect, mock, test } from "bun:test";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuditService } from "@common/audit/audit.service";
import type { QueueService } from "@modules/queue/queue.service";
import type { TenantContext } from "@common/tenancy/tenant-context";
import type { WebhooksEmitter } from "@modules/webhooks/webhooks-emitter.service";
import type { PostRow } from "@database/schema";
import { BlogService } from "../blog.service";

const actor: AuthUser = {
  userId: "usr_test",
  email: "test@test.local",
  isPlatformAdmin: false,
};

describe("BlogService HubSpot source identity on create", () => {
  test("persists linkage on initial insert", async () => {
    const inserts: Record<string, unknown>[] = [];
    const postRow: PostRow = {
      id: "post_1",
      siteId: "site_test",
      title: "Blog",
      slug: "blog",
      locale: "en",
      translationKey: "post_1",
      status: "draft",
      workflowState: "draft",
      excerpt: null,
      layout: null,
      coverMediaId: null,
      seo: {},
      authorId: actor.userId,
      hubspotConnectionId: null,
      hubspotKind: null,
      hubspotHsId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
      parentId: null,
      reviewerId: null,
      reviewNote: null,
      submittedAt: null,
      reviewedAt: null,
      scheduledAt: null,
      publishedAt: null,
      expiresAt: null,
      previewToken: null,
    } as PostRow;

    let selectIdx = 0;
    const selectQueue: unknown[][] = [[], [], [postRow], [], []];

    const db = {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => {
            const rows = selectQueue[selectIdx] ?? [];
            selectIdx += 1;
            return {
              limit: async (n: number) => rows.slice(0, n),
            };
          }),
        })),
      })),
      insert: mock(() => ({
        values: mock((values: Record<string, unknown>) => {
          inserts.push(values);
          return {
            returning: mock(async () => [{ ...postRow, ...values } as PostRow]),
          };
        }),
      })),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(async () => undefined),
        })),
      })),
    };

    const repo = {
      siteId: "site_test",
      db,
      insertDefaults: () => ({ siteId: "site_test" }),
      scope: (_table: unknown, ...conds: unknown[]) => conds[0] ?? true,
    };

    const service = new BlogService(
      repo as unknown as ScopedRepository,
      { record: mock(async () => undefined) } as unknown as AuditService,
      { enqueueCachePurge: mock(async () => undefined) } as unknown as QueueService,
      { userId: actor.userId, requireSiteId: () => "site_test" } as unknown as TenantContext,
      {} as unknown as WebhooksEmitter,
    );

    await service.create({ title: "Blog", slug: "blog" }, actor, {
      hubspotSourceIdentity: {
        hubspotConnectionId: "ccn_test",
        hubspotKind: "blog_post",
        hubspotHsId: "post-1",
      },
    });

    expect(inserts).toHaveLength(1);
    expect(inserts[0].hubspotConnectionId).toBe("ccn_test");
    expect(inserts[0].hubspotKind).toBe("blog_post");
    expect(inserts[0].hubspotHsId).toBe("post-1");
  });
});
