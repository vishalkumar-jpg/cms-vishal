import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyLayout } from "@ob-cms/block-schema";
import { TemplateLibraryMineCard } from "../components/TemplateLibraryMineCard";
import type { TemplateLibraryMineItem } from "../types";

const mineItem = (): TemplateLibraryMineItem => ({
  id: "tpl_mine_1",
  source: "mine",
  title: "Saved Hero",
  description: "Saved layout from your builder",
  preview: {},
  metadata: {
    siteId: "site_1",
    kind: "section",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    canManage: true,
  },
  sourceData: {
    id: "tpl_mine_1",
    siteId: "site_1",
    name: "Saved Hero",
    kind: "section",
    layout: emptyLayout(),
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  },
});

describe("TemplateLibraryMineCard", () => {
  it("renders a live thumbnail shell and kind placeholder before activation", () => {
    const html = renderToStaticMarkup(<TemplateLibraryMineCard item={mineItem()} />);

    expect(html.includes("Saved Hero")).toBe(true);
    expect(html.includes('data-testid="template-thumbnail"')).toBe(true);
    expect(html.includes("Section")).toBe(true);
  });
});
