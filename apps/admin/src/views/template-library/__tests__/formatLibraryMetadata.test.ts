import { describe, expect, it } from "bun:test";
import {
  formatPageTypes,
  formatPreviewDate,
  formatUpdatedDate,
  summarizeTags,
  templateKeyLabel,
} from "../lib/formatLibraryMetadata";

describe("formatLibraryMetadata", () => {
  it("formatUpdatedDate formats valid ISO strings with a fixed locale", () => {
    expect(formatUpdatedDate("2026-08-06T00:00:00.000Z")).toBe("Aug 6, 2026");
  });

  it("formatUpdatedDate returns fallback for invalid dates", () => {
    expect(formatUpdatedDate("not-a-date")).toBe("Unknown date");
  });

  it("formatPreviewDate uses long month form with a fixed locale", () => {
    expect(formatPreviewDate("2026-08-06T12:00:00.000Z")).toBe("August 6, 2026");
  });

  it("formatPageTypes maps known ids and passes through unknown", () => {
    expect(formatPageTypes(["homepage", "blog-detail"])).toBe("Homepage, Blog post");
    expect(formatPageTypes(["custom-type"])).toBe("custom-type");
  });

  it("templateKeyLabel returns the key unchanged", () => {
    expect(templateKeyLabel("tpl-homepage")).toBe("tpl-homepage");
  });

  it("summarizeTags limits visible tags with overflow", () => {
    expect(summarizeTags(["a", "b", "c"])).toEqual({ visible: ["a", "b", "c"], overflow: 0 });
    expect(summarizeTags(["a", "b", "c", "d", "e"], 3)).toEqual({
      visible: ["a", "b", "c"],
      overflow: 2,
    });
  });
});
