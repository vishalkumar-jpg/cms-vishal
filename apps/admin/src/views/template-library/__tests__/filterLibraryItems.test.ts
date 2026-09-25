import { describe, expect, it } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import { filterLibraryItems } from "../lib/filterLibraryItems";
import { mapMineToLibraryItem } from "../lib/mapLibraryItems";
import { MINE_TEMPLATE_DESCRIPTION } from "../constants";
import { legacyTemplateFixture } from "./legacyTemplateFixture";
import type { TemplateLibraryMineItem } from "../types";

const empty = emptyLayout();

const sample: TemplateLibraryMineItem[] = [
  {
    id: "mine-1",
    source: "mine",
    title: "Homepage Hero Block",
    description: MINE_TEMPLATE_DESCRIPTION,
    preview: {},
    metadata: {
      siteId: "site-1",
      kind: "page",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      canManage: true,
    },
    sourceData: {
      id: "mine-1",
      siteId: "site-1",
      name: "Homepage Hero Block",
      kind: "page",
      layout: empty,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    },
  },
  {
    id: "mine-2",
    source: "mine",
    title: "Pricing Section",
    description: MINE_TEMPLATE_DESCRIPTION,
    preview: {},
    metadata: {
      siteId: "site-1",
      kind: "section",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
      canManage: true,
    },
    sourceData: {
      id: "mine-2",
      siteId: "site-1",
      name: "Pricing Section",
      kind: "section",
      layout: empty,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    },
  },
];

describe("filterLibraryItems", () => {
  it("returns all items when search is empty", () => {
    expect(filterLibraryItems(sample, "").length).toBe(2);
    expect(filterLibraryItems(sample, "   ").length).toBe(2);
  });

  it("matches titles case-insensitively", () => {
    expect(filterLibraryItems(sample, "pricing").map((item) => item.id)).toEqual(["mine-2"]);
    expect(filterLibraryItems(sample, "HERO").map((item) => item.id)).toEqual(["mine-1"]);
  });

  it("filters by kind", () => {
    expect(filterLibraryItems(sample, "", "section").map((item) => item.id)).toEqual(["mine-2"]);
    expect(filterLibraryItems(sample, "", "page").map((item) => item.id)).toEqual(["mine-1"]);
  });

  it("matches kind label in search", () => {
    expect(filterLibraryItems(sample, "section").map((item) => item.id)).toEqual(["mine-2"]);
  });

  it("returns no matches when nothing fits", () => {
    expect(filterLibraryItems(sample, "footer")).toEqual([]);
  });

  it("searches legacy templates without runtime errors", () => {
    const legacyItem = mapMineToLibraryItem(
      legacyTemplateFixture({
        id: "legacy-1",
        siteId: "site-1",
        name: "Legacy Homepage",
        layout: empty,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
      "site-1",
    );

    expect(filterLibraryItems([legacyItem], "legacy").map((item) => item.id)).toEqual([
      "legacy-1",
    ]);
    expect(filterLibraryItems([legacyItem], "page").map((item) => item.id)).toEqual(["legacy-1"]);
  });
});
