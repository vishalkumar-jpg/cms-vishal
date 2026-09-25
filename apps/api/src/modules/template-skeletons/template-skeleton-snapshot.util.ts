import { createHash } from "node:crypto";
import type { TemplateSkeletonRecord } from "@ob-cms/template-registry";
import type {
  TemplateSkeletonVersionContentSnapshot,
  TemplateSkeletonVersionMetadataSnapshot,
} from "@database/schema/template-skeletons.schema";

export type TemplateSkeletonSnapshotPayload = {
  metadata: TemplateSkeletonVersionMetadataSnapshot;
  content: TemplateSkeletonVersionContentSnapshot;
};

/** Build an immutable metadata + content snapshot from a live skeleton record. */
export function buildSkeletonSnapshot(record: TemplateSkeletonRecord): TemplateSkeletonSnapshotPayload {
  return {
    metadata: {
      displayName: record.metadata.displayName,
      description: record.metadata.description,
      category: record.metadata.category,
      tags: record.metadata.tags,
      supportedPageTypes: record.metadata.supportedPageTypes,
      previewMetadata: record.metadata.previewMetadata,
      version: record.metadata.version,
      status: record.metadata.status,
      schemaVersion: record.metadata.schemaVersion,
    },
    content: {
      contentSchemaVersion: record.content.contentSchemaVersion,
      layout: record.content.layout,
      sections: record.content.sections as unknown[],
      pageStructure: record.content.pageStructure,
      componentProps: record.content.componentProps,
    },
  };
}

/** Stable digest used to skip duplicate history rows when nothing changed. */
export function skeletonSnapshotDigest(payload: TemplateSkeletonSnapshotPayload): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        metadata: payload.metadata,
        content: payload.content,
      }),
    )
    .digest("hex");
}

export function digestFromSkeletonRecord(record: TemplateSkeletonRecord): string {
  return skeletonSnapshotDigest(buildSkeletonSnapshot(record));
}
