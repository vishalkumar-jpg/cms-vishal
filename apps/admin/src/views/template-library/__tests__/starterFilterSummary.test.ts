import { describe, expect, it } from "bun:test";
import {
  shouldShowFeaturedShelf,
  starterFilterSummary,
  starterFiltersActive,
} from "../lib/starterFilterSummary";

describe("starterFilterSummary", () => {
  it("shouldShowFeaturedShelf is true only with default filters", () => {
    expect(
      shouldShowFeaturedShelf({ search: "", category: "all", featuredOnly: false }),
    ).toBe(true);
    expect(
      shouldShowFeaturedShelf({ search: "hero", category: "all", featuredOnly: false }),
    ).toBe(false);
    expect(
      shouldShowFeaturedShelf({ search: "", category: "marketing", featuredOnly: false }),
    ).toBe(false);
    expect(
      shouldShowFeaturedShelf({ search: "", category: "all", featuredOnly: true }),
    ).toBe(false);
  });

  it("starterFiltersActive detects any active filter", () => {
    expect(starterFiltersActive({ search: "", category: "all", featuredOnly: false })).toBe(
      false,
    );
    expect(starterFiltersActive({ search: "x", category: "all", featuredOnly: false })).toBe(true);
    expect(
      starterFiltersActive({ search: "", category: "marketing", featuredOnly: false }),
    ).toBe(true);
    expect(starterFiltersActive({ search: "", category: "all", featuredOnly: true })).toBe(true);
  });

  it("starterFilterSummary joins category, featured, and search", () => {
    expect(
      starterFilterSummary({ search: "", category: "all", featuredOnly: false }),
    ).toBe(null);
    expect(
      starterFilterSummary({ search: "", category: "marketing", featuredOnly: true }),
    ).toBe("Marketing • Featured");
    expect(
      starterFilterSummary({ search: "landing", category: "all", featuredOnly: false }),
    ).toBe("“landing”");
  });
});
