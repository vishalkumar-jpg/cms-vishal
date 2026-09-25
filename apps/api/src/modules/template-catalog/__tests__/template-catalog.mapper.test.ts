import { describe, expect, test } from "bun:test";
import type {
  TemplateSkeletonAssetRow,
  TemplateSkeletonRow,
} from "@database/schema/template-skeletons.schema";
import {
  resolveThumbnailUrl,
  toAssetSummary,
  toCatalogEntry,
} from "../template-catalog.mapper";

const now = new Date("2026-07-30T12:00:00.000Z");

function skeletonRow(
  overrides: Partial<TemplateSkeletonRow> = {},
): TemplateSkeletonRow {
  return {
    id: "tsk_home",
    templateKey: "tpl-homepage",
    displayName: "Homepage",
    description: "Primary marketing home",
    category: "marketing",
    tags: ["home"],
    supportedPageTypes: ["homepage"],
    previewMetadata: { featured: true, owner: "platform" },
    version: "1.0.0",
    status: "published",
    schemaVersion: "1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function assetRow(overrides: Partial<TemplateSkeletonAssetRow> = {}): TemplateSkeletonAssetRow {
  return {
    id: "tsa_thumb",
    skeletonId: "tsk_home",
    assetType: "thumbnail",
    storageKey: null,
    url: "https://cdn.example.com/thumb.png",
    mimeType: "image/png",
    width: null,
    height: null,
    size: null,
    altText: "Preview",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("template catalog mapper", () => {
  test("maps skeleton metadata into catalog entry", () => {
    const entry = toCatalogEntry(skeletonRow());
    expect(entry?.templateKey).toBe("tpl-homepage");
    expect(entry?.featured).toBe(true);
    expect(entry?.owner).toBe("platform");
    expect(entry?.createdAt).toBe("2026-07-30T12:00:00.000Z");
  });

  test("flattens previewMetadata fields onto entry", () => {
    const entry = toCatalogEntry(
      skeletonRow({
        previewMetadata: {
          featured: false,
          thumbnail: "https://cdn.example.com/meta.png",
          owner: "editor",
        },
      }),
    );
    expect(entry?.featured).toBe(false);
    expect(entry?.thumbnail).toBe("https://cdn.example.com/meta.png");
    expect(entry?.owner).toBe("editor");
  });

  test("prefers previewMetadata thumbnail over asset url", () => {
    const thumbnail = resolveThumbnailUrl(
      { thumbnail: "https://cdn.example.com/meta.png" },
      [assetRow({ url: "https://cdn.example.com/asset.png" })],
    );
    expect(thumbnail).toBe("https://cdn.example.com/meta.png");
  });

  test("falls back to thumbnail asset url", () => {
    const thumbnail = resolveThumbnailUrl({}, [assetRow()]);
    expect(thumbnail).toBe("https://cdn.example.com/thumb.png");
  });

  test("returns null when supportedPageTypes is empty", () => {
    expect(toCatalogEntry(skeletonRow({ supportedPageTypes: [] }))).toBeNull();
  });

  test("returns null when category fails catalog schema validation", () => {
    expect(toCatalogEntry(skeletonRow({ category: "invalid-category" }))).toBeNull();
  });

  test("returns null when status fails catalog schema validation", () => {
    expect(toCatalogEntry(skeletonRow({ status: "invalid-status" }))).toBeNull();
  });

  test("returns null when thumbnail url fails catalog schema validation", () => {
    expect(
      toCatalogEntry(
        skeletonRow({
          previewMetadata: { thumbnail: "not-a-url" },
        }),
      ),
    ).toBeNull();
  });

  test("maps asset rows to catalog summaries", () => {
    const summary = toAssetSummary(assetRow());
    expect(summary.assetType).toBe("thumbnail");
    expect(summary.url).toBe("https://cdn.example.com/thumb.png");
    expect(summary.sortOrder).toBe(0);
  });

  test("includes previewAssets when requested", () => {
    const entry = toCatalogEntry(skeletonRow(), {
      assets: [assetRow(), assetRow({ id: "tsa_gallery", assetType: "gallery_image" })],
      includePreviewAssets: true,
    });
    expect(entry?.previewAssets).toHaveLength(2);
  });

  test("omits previewAssets when includePreviewAssets is false", () => {
    const entry = toCatalogEntry(skeletonRow(), {
      assets: [assetRow()],
      includePreviewAssets: false,
    });
    expect(entry?.previewAssets).toBeUndefined();
    expect(entry?.thumbnail).toBe("https://cdn.example.com/thumb.png");
  });
});
