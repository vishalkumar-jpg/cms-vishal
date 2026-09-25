import { describe, expect, it } from "bun:test";
import {
  duplicateTemplateName,
  isSiteOwnedTemplate,
} from "../lib/mineTemplateActions";
import { mapMineToLibraryItem, mapMineToLibraryItems } from "../lib/mapLibraryItems";
import { filterLibraryItems } from "../lib/filterLibraryItems";
import { legacyTemplateFixture } from "./legacyTemplateFixture";
import type { Template } from "@/views/templates/types";
import { emptyLayout } from "@ob-cms/block-schema";

describe("isSiteOwnedTemplate", () => {
  it("returns true only for templates owned by the active site", () => {
    expect(isSiteOwnedTemplate("site-1", "site-1")).toBe(true);
    expect(isSiteOwnedTemplate("site-2", "site-1")).toBe(false);
    expect(isSiteOwnedTemplate(null, "site-1")).toBe(false);
    expect(isSiteOwnedTemplate(undefined, "site-1")).toBe(false);
    expect(isSiteOwnedTemplate("site-1", null)).toBe(false);
  });
});

describe("duplicateTemplateName", () => {
  it("prefixes the source name", () => {
    expect(duplicateTemplateName("Hero")).toBe("Copy of Hero");
  });

  it("truncates to the API name limit", () => {
    const longName = "x".repeat(200);
    expect(duplicateTemplateName(longName).length).toBe(200);
  });
});

describe("mapMineToLibraryItem", () => {
  const layout = emptyLayout();

  it("defaults legacy templates without kind to page", () => {
    const item = mapMineToLibraryItem(
      legacyTemplateFixture({
        id: "1",
        siteId: "site-1",
        name: "Legacy Template",
        layout,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      }),
      "site-1",
    );

    expect(item.metadata.kind).toBe("page");
  });

  it("includes legacy templates when filtering page templates", () => {
    const items = [
      mapMineToLibraryItem(
        legacyTemplateFixture({
          id: "1",
          siteId: "site-1",
          name: "Legacy",
          layout,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        }),
        "site-1",
      ),
    ];

    expect(filterLibraryItems(items, "", "page").length).toBe(1);
  });
});

describe("mapMineToLibraryItems", () => {
  const layout = emptyLayout();
  const siteOwned: Template = {
    id: "tpl-1",
    siteId: "site-1",
    name: "Site template",
    kind: "page",
    layout,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  };
  const globalPreset: Template = {
    id: "tpl-global",
    siteId: null,
    name: "Global preset",
    kind: "section",
    layout,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  };

  it("filters out global presets and marks site-owned items as manageable", () => {
    const items = mapMineToLibraryItems([siteOwned, globalPreset], "site-1");
    expect(items.length).toBe(1);
    expect(items[0]?.id).toBe("tpl-1");
    expect(items[0]?.metadata.canManage).toBe(true);
  });
});
