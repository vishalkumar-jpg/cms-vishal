import { describe, expect, it } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import {
  sortMineLibraryItems,
  sortStarterLibraryItems,
} from "../lib/sortLibraryItems";
import type { TemplateLibraryMineItem, TemplateLibraryStarterItem } from "../types";

const starter = (id: string, title: string, featured?: boolean): TemplateLibraryStarterItem => ({
  id,
  source: "starter",
  title,
  description: "Desc",
  preview: {},
  metadata: {
    category: "marketing",
    tags: [],
    featured,
    status: "published",
    templateKey: `tpl-${id}`,
    version: "1.0.0",
    supportedPageTypes: ["page"],
    canUse: true,
  },
  sourceData: {
    id,
    templateKey: `tpl-${id}`,
    displayName: title,
    description: "Desc",
    category: "marketing",
    supportedPageTypes: ["page"],
    tags: [],
    version: "1.0.0",
    status: "published",
    featured,
    updatedAt: id === "a" ? "2026-08-01T00:00:00.000Z" : "2026-08-03T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
});

const mine = (id: string, title: string, updatedAt: string): TemplateLibraryMineItem => ({
  id,
  source: "mine",
  title,
  description: "Saved layout from your builder",
  preview: {},
  metadata: {
    siteId: "site-1",
    kind: "page",
    createdAt: updatedAt,
    updatedAt,
    canManage: true,
  },
  sourceData: {
    id,
    siteId: "site-1",
    name: title,
    kind: "page",
    layout: emptyLayout(),
    createdAt: updatedAt,
    updatedAt,
  },
});

describe("sortStarterLibraryItems", () => {
  it("sorts alphabetically by default", () => {
    const items = [starter("b", "Beta"), starter("a", "Alpha")];
    expect(sortStarterLibraryItems(items, "name-asc").map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("sorts featured first", () => {
    const items = [starter("a", "Alpha"), starter("b", "Beta", true)];
    expect(sortStarterLibraryItems(items, "featured").map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("sortMineLibraryItems", () => {
  it("sorts by updated descending", () => {
    const items = [
      mine("old", "Old", "2026-08-01T00:00:00.000Z"),
      mine("new", "New", "2026-08-03T00:00:00.000Z"),
    ];
    expect(sortMineLibraryItems(items, "updated-desc").map((i) => i.id)).toEqual(["new", "old"]);
  });
});
