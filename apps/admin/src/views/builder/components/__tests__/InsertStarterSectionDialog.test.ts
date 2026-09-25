import { describe, expect, it } from "bun:test";
import { STARTER_SECTION_CATALOG } from "../../sections/starterSectionCatalog";

describe("InsertStarterSectionDialog catalog coverage", () => {
  it("includes hero, faq, pricing, and cta starter sections", () => {
    const categories = new Set(STARTER_SECTION_CATALOG.map((entry) => entry.category));
    expect(categories.has("Hero")).toBe(true);
    expect(categories.has("FAQ")).toBe(true);
    expect(categories.has("Pricing")).toBe(true);
    expect(categories.has("CTA")).toBe(true);
  });
});
