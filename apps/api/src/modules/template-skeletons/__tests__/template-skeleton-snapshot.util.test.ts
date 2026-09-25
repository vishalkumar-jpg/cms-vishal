import { describe, expect, test } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import { SKELETON_CONTENT_SCHEMA_VERSION, type TemplateSkeletonRecord } from "@ob-cms/template-registry";
import {
  buildSkeletonSnapshot,
  digestFromSkeletonRecord,
  skeletonSnapshotDigest,
} from "../template-skeleton-snapshot.util";

const layout = emptyLayout();

const record: TemplateSkeletonRecord = {
  metadata: {
    id: "tsk_test",
    templateKey: "tpl-test",
    displayName: "Test",
    description: "Desc",
    category: "marketing",
    supportedPageTypes: ["landing"],
    tags: ["a"],
    previewMetadata: { featured: true },
    version: "1.4.0",
    status: "published",
    schemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  content: {
    contentSchemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
    layout,
    sections: [],
    pageStructure: {
      defaultSectionOrder: [],
      requiredSectionIds: [],
      optionalSectionIds: [],
    },
    componentProps: {},
  },
};

describe("template skeleton snapshot util", () => {
  test("buildSkeletonSnapshot freezes metadata and content", () => {
    const snapshot = buildSkeletonSnapshot(record);
    expect(snapshot.metadata.displayName).toBe("Test");
    expect(snapshot.metadata.version).toBe("1.4.0");
    expect(snapshot.content.layout).toEqual(layout);
    expect(snapshot.metadata).not.toHaveProperty("id");
    expect(snapshot.metadata).not.toHaveProperty("templateKey");
  });

  test("skeletonSnapshotDigest is stable for identical payloads", () => {
    const snapshot = buildSkeletonSnapshot(record);
    expect(skeletonSnapshotDigest(snapshot)).toBe(skeletonSnapshotDigest(snapshot));
    expect(digestFromSkeletonRecord(record)).toBe(skeletonSnapshotDigest(snapshot));
  });

  test("skeletonSnapshotDigest changes when version changes", () => {
    const first = buildSkeletonSnapshot(record);
    const second = buildSkeletonSnapshot({
      ...record,
      metadata: { ...record.metadata, version: "1.5.0" },
    });
    expect(skeletonSnapshotDigest(first)).not.toBe(skeletonSnapshotDigest(second));
  });
});
