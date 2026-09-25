import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import {
  TEMPLATE_SKELETON_STORAGE,
  type TemplateSkeletonStorage,
} from "@ob-cms/template-registry";
import { pages } from "@database/schema/pages.schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";

export type TemplateSkeletonUsagePage = {
  id: string;
  title: string;
  slug: string;
  status: string;
  sourceTemplateVersion: string;
  instantiatedAt: string;
};

export type TemplateSkeletonUsageByVersion = {
  version: string;
  count: number;
};

export type TemplateSkeletonUsage = {
  skeletonId: string;
  templateKey: string;
  totalPages: number;
  lastUsedAt: string | null;
  currentVersion: string;
  latestVersion: string;
  pages: TemplateSkeletonUsagePage[];
  byVersion: TemplateSkeletonUsageByVersion[];
};

export type TopTemplateUsageEntry = {
  skeletonId: string | null;
  templateKey: string;
  totalPages: number;
  lastUsedAt: string | null;
};

/** Read-only template usage analytics — aggregates from site-scoped pages provenance. */
@Injectable()
export class TemplateSkeletonUsageService {
  constructor(
    private readonly repo: ScopedRepository,
    @Inject(TEMPLATE_SKELETON_STORAGE)
    private readonly storage: TemplateSkeletonStorage,
  ) {}

  async getUsageBySkeletonId(skeletonId: string): Promise<TemplateSkeletonUsage> {
    const skeleton = await this.storage.findById(skeletonId);
    if (!skeleton) throw new NotFoundException("Template skeleton not found");

    const templateKey = skeleton.metadata.templateKey;
    const where = this.provenanceWhere(templateKey);

    const [totals] = await this.repo.db
      .select({
        totalPages: sql<number>`count(*)::int`,
        lastUsedAt: sql<Date | null>`max(${pages.instantiatedAt})`,
      })
      .from(pages)
      .where(where);

    const byVersionRows = await this.repo.db
      .select({
        version: pages.sourceTemplateVersion,
        count: sql<number>`count(*)::int`,
      })
      .from(pages)
      .where(where)
      .groupBy(pages.sourceTemplateVersion)
      .orderBy(desc(sql`count(*)`));

    const pageRows = await this.repo.db
      .select({
        id: pages.id,
        title: pages.title,
        slug: pages.slug,
        status: pages.status,
        sourceTemplateVersion: pages.sourceTemplateVersion,
        instantiatedAt: pages.instantiatedAt,
      })
      .from(pages)
      .where(where)
      .orderBy(desc(pages.instantiatedAt))
      .limit(25);

    const latestVersion = skeleton.metadata.version;

    return {
      skeletonId: skeleton.metadata.id,
      templateKey,
      totalPages: Number(totals?.totalPages ?? 0),
      lastUsedAt: totals?.lastUsedAt ? new Date(totals.lastUsedAt).toISOString() : null,
      currentVersion: skeleton.metadata.version,
      latestVersion,
      pages: pageRows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        sourceTemplateVersion: row.sourceTemplateVersion ?? latestVersion,
        instantiatedAt: row.instantiatedAt?.toISOString() ?? new Date(0).toISOString(),
      })),
      byVersion: (() => {
        const counts = new Map<string, number>();
        for (const row of byVersionRows) {
          const version = row.version ?? latestVersion;
          counts.set(version, (counts.get(version) ?? 0) + Number(row.count));
        }
        return [...counts.entries()]
          .map(([version, count]) => ({ version, count }))
          .sort((a, b) => b.count - a.count);
      })(),
    };
  }

  async getTopTemplates(limit = 10): Promise<TopTemplateUsageEntry[]> {
    const parsed = Number(limit);
    const normalized = Number.isFinite(parsed) ? parsed : 10;
    const cappedLimit = Math.min(100, Math.max(1, normalized));
    const where = this.repo.scope(
      pages,
      isNotNull(pages.sourceTemplateKey),
      isNotNull(pages.instantiatedAt),
    );

    const rows = await this.repo.db
      .select({
        skeletonId: pages.sourceTemplateId,
        templateKey: pages.sourceTemplateKey,
        totalPages: sql<number>`count(*)::int`,
        lastUsedAt: sql<Date | null>`max(${pages.instantiatedAt})`,
      })
      .from(pages)
      .where(where)
      .groupBy(pages.sourceTemplateKey, pages.sourceTemplateId)
      .orderBy(desc(sql`count(*)`), desc(sql`max(${pages.instantiatedAt})`))
      .limit(cappedLimit);

    return rows
      .filter((row) => row.templateKey)
      .map((row) => ({
        skeletonId: row.skeletonId,
        templateKey: row.templateKey!,
        totalPages: Number(row.totalPages),
        lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
      }));
  }

  private provenanceWhere(templateKey: string) {
    return this.repo.scope(
      pages,
      eq(pages.sourceTemplateKey, templateKey),
      isNotNull(pages.instantiatedAt),
    );
  }
}
