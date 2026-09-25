import { describe, expect, it } from "bun:test";
import {
  STARTER_SECTION_CATALOG,
  filterStarterSectionCatalog,
  starterSectionTemplateKeys,
} from "../starterSectionCatalog";

describe("starterSectionCatalog", () => {
  it("defines unique starter section ids", () => {
    const ids = STARTER_SECTION_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toEqual(ids.length);
    expect(ids.length > 10).toBe(true);
  });

  it("filters by search and category", () => {
    const heroOnly = filterStarterSectionCatalog(STARTER_SECTION_CATALOG, "", "Hero");
    expect(heroOnly.every((entry) => entry.category === "Hero")).toBe(true);
    expect(heroOnly.length > 0).toBe(true);

    const search = filterStarterSectionCatalog(STARTER_SECTION_CATALOG, "pricing", "all");
    expect(search.length).toBeGreaterThan(0);
    expect(search.length).toBeLessThan(STARTER_SECTION_CATALOG.length);
    expect(
      search.every((entry) =>
        `${entry.title} ${entry.description} ${entry.category} ${entry.templateKey}`
          .toLowerCase()
          .includes("pricing"),
      ),
    ).toBe(true);
  });

  it("returns unique template keys for skeleton prefetch", () => {
    const keys = starterSectionTemplateKeys();
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("tpl-saas-landing");
    expect(keys).toContain("tpl-faq");
  });
});
