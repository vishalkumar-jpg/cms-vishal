import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { TemplateSkeletonRecord } from "@ob-cms/template-registry";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import {
  templateSkeletonVersions,
  type TemplateSkeletonVersionRow,
} from "@database/schema/template-skeletons.schema";
import {
  buildSkeletonSnapshot,
  skeletonSnapshotDigest,
  type TemplateSkeletonSnapshotPayload,
} from "./template-skeleton-snapshot.util";

export type TemplateSkeletonDbTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

export type TemplateSkeletonVersionSummary = {
  skeletonId: string;
  templateKey: string;
  version: string;
  createdAt: string;
  createdBy: string | null;
  metadata: TemplateSkeletonSnapshotPayload["metadata"];
};

export type TemplateSkeletonVersionDetail = TemplateSkeletonVersionSummary & {
  content: TemplateSkeletonSnapshotPayload["content"];
};

@Injectable()
export class TemplateSkeletonVersionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async appendIfChanged(
    record: TemplateSkeletonRecord,
    createdBy?: string | null,
  ): Promise<boolean> {
    return this.appendIfChangedWithTx(this.db, record, createdBy);
  }

  /** Append a version snapshot within an open transaction (used for atomic skeleton writes). */
  async appendIfChangedWithTx(
    tx: TemplateSkeletonDbTx | Database,
    record: TemplateSkeletonRecord,
    createdBy?: string | null,
  ): Promise<boolean> {
    const snapshot = buildSkeletonSnapshot(record);
    const digest = skeletonSnapshotDigest(snapshot);
    const latest = await this.findLatestDigestWithTx(tx, record.metadata.id);
    if (latest === digest) return false;

    try {
      await tx.insert(templateSkeletonVersions).values({
        skeletonId: record.metadata.id,
        templateKey: record.metadata.templateKey,
        version: record.metadata.version,
        metadata: snapshot.metadata,
        content: snapshot.content,
        snapshotDigest: digest,
        createdBy: createdBy ?? null,
      });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  private async findLatestDigestWithTx(
    tx: TemplateSkeletonDbTx | Database,
    skeletonId: string,
  ): Promise<string | null> {
    const [row] = await tx
      .select({ snapshotDigest: templateSkeletonVersions.snapshotDigest })
      .from(templateSkeletonVersions)
      .where(eq(templateSkeletonVersions.skeletonId, skeletonId))
      .orderBy(desc(templateSkeletonVersions.createdAt))
      .limit(1);
    return row?.snapshotDigest ?? null;
  }

  async listBySkeletonId(skeletonId: string): Promise<TemplateSkeletonVersionSummary[]> {
    const rows = await this.db
      .select()
      .from(templateSkeletonVersions)
      .where(eq(templateSkeletonVersions.skeletonId, skeletonId))
      .orderBy(desc(templateSkeletonVersions.createdAt));

    return rows.map((row) => this.toSummary(row));
  }

  async findBySkeletonIdAndVersion(
    skeletonId: string,
    version: string,
  ): Promise<TemplateSkeletonVersionDetail | null> {
    const rows = await this.db
      .select()
      .from(templateSkeletonVersions)
      .where(
        and(
          eq(templateSkeletonVersions.skeletonId, skeletonId),
          eq(templateSkeletonVersions.version, version),
        ),
      )
      .orderBy(desc(templateSkeletonVersions.createdAt))
      .limit(1);

    const row = rows[0];
    return row ? this.toDetail(row) : null;
  }

  async countBySkeletonId(skeletonId: string): Promise<number> {
    const rows = await this.db
      .select({ id: templateSkeletonVersions.id })
      .from(templateSkeletonVersions)
      .where(eq(templateSkeletonVersions.skeletonId, skeletonId));
    return rows.length;
  }

  private toSummary(row: TemplateSkeletonVersionRow): TemplateSkeletonVersionSummary {
    return {
      skeletonId: row.skeletonId,
      templateKey: row.templateKey,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      metadata: row.metadata,
    };
  }

  private toDetail(row: TemplateSkeletonVersionRow): TemplateSkeletonVersionDetail {
    return {
      ...this.toSummary(row),
      content: row.content,
    };
  }
}

/** Seed/backfill helper — append when no history exists yet for a skeleton. */
export async function backfillSkeletonVersionIfEmpty(
  db: Database,
  record: TemplateSkeletonRecord,
): Promise<boolean> {
  const repo = new TemplateSkeletonVersionRepository(db);
  const count = await repo.countBySkeletonId(record.metadata.id);
  if (count > 0) return false;
  return repo.appendIfChanged(record, null);
}

/** Seed helper — append after insert/refresh (skips unchanged digest). */
export async function appendSkeletonVersionSnapshot(
  db: Database,
  record: TemplateSkeletonRecord,
  createdBy?: string | null,
): Promise<boolean> {
  const repo = new TemplateSkeletonVersionRepository(db);
  return repo.appendIfChanged(record, createdBy);
}
