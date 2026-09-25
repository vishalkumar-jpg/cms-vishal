import { describe, expect, it } from "bun:test";
import { mineFilterSummary, mineFiltersActive } from "../lib/mineFilterSummary";

describe("mineFilterSummary", () => {
  it("mineFiltersActive detects search or kind filters", () => {
    expect(mineFiltersActive("", "all")).toBe(false);
    expect(mineFiltersActive("hero", "all")).toBe(true);
    expect(mineFiltersActive("", "page")).toBe(true);
  });

  it("mineFilterSummary joins kind and search", () => {
    expect(mineFilterSummary("", "all")).toBe(null);
    expect(mineFilterSummary("", "section")).toBe("Section");
    expect(mineFilterSummary("footer", "page")).toBe("Page • “footer”");
  });
});
