import { describe, expect, it } from "bun:test";
import { formatImportRunResultCounts } from "../lib/formatImportRunResults";

describe("formatImportRunResultCounts", () => {
  it("shows imported counts for first-run style summary", () => {
    expect(
      formatImportRunResultCounts({
        importedPages: 68,
        importedPosts: 0,
        skipped: [],
      }),
    ).toBe("68 pages imported, 0 posts");
  });

  it("shows updated counts when idempotent re-import creates nothing new", () => {
    expect(
      formatImportRunResultCounts({
        importedPages: 0,
        importedPosts: 0,
        updatedPages: 2,
        updatedPosts: 0,
        skipped: Array.from({ length: 224 }, (_, i) => ({
          name: `page:${i}`,
          reason: "slug",
        })),
      }),
    ).toBe("2 pages updated, 0 posts (224 items skipped)");
  });

  it("shows mixed imported and updated per content kind", () => {
    expect(
      formatImportRunResultCounts({
        importedPages: 10,
        importedPosts: 5,
        updatedPages: 3,
        updatedPosts: 0,
        skipped: [],
      }),
    ).toBe("10 pages imported, 3 pages updated, 5 posts imported");
  });

  it("includes skipped count when present", () => {
    expect(
      formatImportRunResultCounts({
        importedPages: 1,
        importedPosts: 0,
        skipped: [{ name: "page:a", reason: "conflict" }],
      }),
    ).toBe("1 page imported, 0 posts (1 item skipped)");
  });

  it("legacy summary without updated fields still renders imported counts", () => {
    expect(
      formatImportRunResultCounts({
        importedPages: 4,
        importedPosts: 2,
        skipped: [],
      }),
    ).toBe("4 pages imported, 2 posts imported");
  });

  it("all-zero summary with no updated fields", () => {
    expect(
      formatImportRunResultCounts({
        importedPages: 0,
        importedPosts: 0,
        skipped: [],
      }),
    ).toBe("0 pages, 0 posts");
  });
});
