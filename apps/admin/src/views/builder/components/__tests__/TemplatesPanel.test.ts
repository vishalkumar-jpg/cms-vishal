import { describe, expect, it } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import { filterLibraryItems } from "@/views/template-library/lib/filterLibraryItems";
import { isSiteOwnedTemplate } from "@/views/template-library/lib/mineTemplateActions";
import { sortMineLibraryItems } from "@/views/template-library/lib/sortLibraryItems";
import type { TemplateLibraryMineItem } from "@/views/template-library/types";
import type { Template } from "@/views/templates/types";

const empty = emptyLayout();

const template = (overrides: Partial<Template>): Template => ({
  id: "tpl-1",
  siteId: "site-1",
  name: "Owned template",
  kind: "page",
  layout: empty,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  ...overrides,
});

const toMineItem = (t: Template): TemplateLibraryMineItem => ({
  id: t.id,
  source: "mine",
  title: t.name,
  description: "",
  preview: {},
  metadata: {
    siteId: t.siteId,
    kind: t.kind ?? "page",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    canManage: true,
  },
  sourceData: t,
});

/** Mirrors TemplatesPanel's site-owned filter before search/kind/sort. */
const filterSiteOwnedTemplates = (templates: Template[], siteId: string | null): Template[] =>
  templates.filter((t) => isSiteOwnedTemplate(t.siteId, siteId));

/** Mirrors TemplatesPanel filtered list pipeline. */
const panelFiltered = (
  templates: Template[],
  siteId: string | null,
  search: string,
  kind: "all" | "page" | "section" = "all",
) => {
  const owned = filterSiteOwnedTemplates(templates, siteId).map(toMineItem);
  return sortMineLibraryItems(filterLibraryItems(owned, search, kind), "updated-desc");
};

describe("TemplatesPanel site-owned filter", () => {
  it("excludes global presets (siteId null) from the builder panel list", () => {
    const templates = [
      template({ id: "owned", siteId: "site-1", name: "My layout" }),
      template({ id: "global", siteId: null, name: "Platform preset" }),
    ];

    const owned = filterSiteOwnedTemplates(templates, "site-1");
    expect(owned.map((t) => t.id)).toEqual(["owned"]);
  });

  it("returns empty when API only returns global templates", () => {
    const templates = [template({ id: "global", siteId: null, name: "Platform preset" })];
    expect(filterSiteOwnedTemplates(templates, "site-1")).toEqual([]);
  });
});

describe("TemplatesPanel filter and sort", () => {
  it("filters by kind and search using shared library helpers", () => {
    const templates = [
      template({ id: "page-a", name: "Hero page", kind: "page", updatedAt: "2026-08-03T00:00:00.000Z" }),
      template({ id: "section-b", name: "Footer block", kind: "section", updatedAt: "2026-08-04T00:00:00.000Z" }),
    ];

    expect(panelFiltered(templates, "site-1", "", "section").map((i) => i.id)).toEqual(["section-b"]);
    expect(panelFiltered(templates, "site-1", "hero", "all").map((i) => i.id)).toEqual(["page-a"]);
  });

  it("sorts by updated date descending", () => {
    const templates = [
      template({ id: "older", name: "Older", updatedAt: "2026-08-01T00:00:00.000Z" }),
      template({ id: "newer", name: "Newer", updatedAt: "2026-08-05T00:00:00.000Z" }),
    ];

    expect(panelFiltered(templates, "site-1", "", "all").map((i) => i.id)).toEqual([
      "newer",
      "older",
    ]);
  });
});
