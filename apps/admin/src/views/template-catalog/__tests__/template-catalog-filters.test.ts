import { describe, expect, it } from "bun:test";
import { filterTemplateCatalogEntries } from "../lib/filterTemplateCatalogEntries";
import type { TemplateCatalogEntry } from "../types";

const sample: TemplateCatalogEntry[] = [
  {
    id: "1",
    templateKey: "tpl-blank",
    displayName: "Blank Page",
    description: "Empty starter canvas",
    category: "utility",
    supportedPageTypes: ["generic-content"],
    tags: ["starter"],
    version: "1.0.0",
    status: "published",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  },
  {
    id: "2",
    templateKey: "tpl-contact",
    displayName: "Contact Page",
    description: "Form inquiry layout",
    category: "marketing",
    supportedPageTypes: ["contact"],
    tags: ["lead-gen"],
    version: "1.0.0",
    status: "published",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  },
  {
    id: "3",
    templateKey: "tpl-saas-landing",
    displayName: "SaaS Landing",
    description: "LP hero",
    category: "campaign",
    supportedPageTypes: ["landing"],
    tags: ["saas", "conversion"],
    version: "1.0.0",
    status: "draft",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  },
];

describe("filterTemplateCatalogEntries", () => {
  it("filters by display name search", () => {
    const result = filterTemplateCatalogEntries(sample, "contact", "all");
    expect(result.map((e) => e.templateKey)).toEqual(["tpl-contact"]);
  });

  it("filters by template key", () => {
    expect(
      filterTemplateCatalogEntries(sample, "tpl-saas", "all").map((e) => e.templateKey),
    ).toEqual(["tpl-saas-landing"]);
  });

  it("filters by description", () => {
    expect(
      filterTemplateCatalogEntries(sample, "inquiry", "all").map((e) => e.templateKey),
    ).toEqual(["tpl-contact"]);
  });

  it("filters by tag", () => {
    expect(
      filterTemplateCatalogEntries(sample, "conversion", "all").map((e) => e.templateKey),
    ).toEqual(["tpl-saas-landing"]);
  });

  it("filters by category", () => {
    const result = filterTemplateCatalogEntries(sample, "", "marketing");
    expect(result.map((e) => e.templateKey)).toEqual(["tpl-contact"]);
  });

  it("combines search and category", () => {
    expect(
      filterTemplateCatalogEntries(sample, "page", "utility").map((e) => e.templateKey),
    ).toEqual(["tpl-blank"]);
    expect(filterTemplateCatalogEntries(sample, "page", "campaign")).toEqual([]);
  });

  it("filters featured only", () => {
    const featured = { ...sample[1], featured: true };
    const rows = [sample[0], featured, sample[2]];
    expect(
      filterTemplateCatalogEntries(rows, "", "all", { featuredOnly: true }).map((e) => e.id),
    ).toEqual(["2"]);
  });

  it("matches category label in search", () => {
    expect(
      filterTemplateCatalogEntries(sample, "marketing", "all").map((e) => e.templateKey),
    ).toEqual(["tpl-contact"]);
  });
});
