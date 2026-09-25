import { describe, expect, test } from "bun:test";
import {
  TemplateCatalogValidationError,
  parseTemplateCatalogAssetSummary,
  parseTemplateCatalogEntry,
  parseTemplateCatalogQuery,
} from "../catalog-schema";

const iso = "2026-07-30T12:00:00.000Z";

const validAssetSummary = {
  id: "tsa_thumb",
  assetType: "thumbnail",
  url: "https://cdn.example.com/thumb.png",
  mimeType: "image/png",
  altText: "Homepage preview",
  sortOrder: 0,
};

const validEntry = {
  id: "tsk_home",
  templateKey: "tpl-homepage",
  displayName: "Homepage",
  description: "Primary marketing home",
  category: "marketing",
  supportedPageTypes: ["homepage"],
  tags: ["home", "brand"],
  version: "1.0.0",
  status: "published",
  featured: true,
  thumbnail: "https://cdn.example.com/thumb.png",
  owner: "platform",
  previewAssets: [validAssetSummary],
  createdAt: iso,
  updatedAt: iso,
};

describe("template catalog schema", () => {
  test("accepts valid catalog entry", () => {
    const parsed = parseTemplateCatalogEntry(validEntry);
    expect(parsed.templateKey).toBe("tpl-homepage");
    expect(parsed.featured).toBe(true);
    expect(parsed.previewAssets).toHaveLength(1);
    expect(parsed.thumbnail).toBe("https://cdn.example.com/thumb.png");
  });

  test("accepts site-relative thumbnail url", () => {
    const parsed = parseTemplateCatalogEntry({ ...validEntry, thumbnail: "/images/thumb.png" });
    expect(parsed.thumbnail).toBe("/images/thumb.png");
  });

  test("rejects invalid thumbnail url", () => {
    expect(() =>
      parseTemplateCatalogEntry({ ...validEntry, thumbnail: "not-a-url" }),
    ).toThrow(TemplateCatalogValidationError);
  });

  test("rejects invalid category on catalog entry", () => {
    expect(() =>
      parseTemplateCatalogEntry({ ...validEntry, category: "invalid-category" }),
    ).toThrow(TemplateCatalogValidationError);
  });

  test("rejects invalid sort on catalog query", () => {
    expect(() => parseTemplateCatalogQuery({ sort: "name" })).toThrow(
      TemplateCatalogValidationError,
    );
  });

  test("parses featured filter on catalog query", () => {
    const parsed = parseTemplateCatalogQuery({ featured: true, category: "marketing" });
    expect(parsed.featured).toBe(true);
    expect(parsed.category).toBe("marketing");
  });

  test("defaults includeAssets to false", () => {
    const parsed = parseTemplateCatalogQuery({});
    expect(parsed.includeAssets).toBe(false);
  });

  test("defaults sort to displayName", () => {
    const parsed = parseTemplateCatalogQuery({});
    expect(parsed.sort).toBe("displayName");
  });

  test("accepts includeAssets true and updatedAt sort", () => {
    const parsed = parseTemplateCatalogQuery({ includeAssets: true, sort: "updatedAt" });
    expect(parsed.includeAssets).toBe(true);
    expect(parsed.sort).toBe("updatedAt");
  });

  test("validates asset summary fields", () => {
    const parsed = parseTemplateCatalogAssetSummary(validAssetSummary);
    expect(parsed.assetType).toBe("thumbnail");
    expect(parsed.url).toBe("https://cdn.example.com/thumb.png");
  });

  test("rejects asset summary with invalid url", () => {
    expect(() =>
      parseTemplateCatalogAssetSummary({ ...validAssetSummary, url: "not-a-url" }),
    ).toThrow(TemplateCatalogValidationError);
  });

  test("rejects catalog entry with layout payload", () => {
    expect(() =>
      parseTemplateCatalogEntry({ ...validEntry, layout: { root: "ROOT" } }),
    ).toThrow(TemplateCatalogValidationError);
  });

  test("rejects empty catalog query object with unknown keys", () => {
    expect(() => parseTemplateCatalogQuery({ unknown: true })).toThrow(
      TemplateCatalogValidationError,
    );
  });
});
