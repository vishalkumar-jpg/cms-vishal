import { describe, expect, it } from "bun:test";
import { emptyLayout, type SerializedLayout } from "@ob-cms/block-schema";
import { layoutToCraft } from "@/views/builder/craft/serialize";
import { pickPreviewItem } from "../pickPreviewItem";
import type { CollectionItem } from "../types";

const sampleItem = (id: string): CollectionItem => ({
  id,
  siteId: "site_1",
  collectionId: "col_1",
  slug: id,
  data: {},
  status: "draft",
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("CollectionDetailBuilder bootstrap", () => {
  it("produces Craft JSON from emptyLayout when detailLayout is null", () => {
    const json = JSON.stringify(layoutToCraft(emptyLayout()));
    expect(json).toContain("ROOT");
  });

  it("produces Craft JSON from a populated detailLayout", () => {
    const layout = emptyLayout();
    layout.nodes = {
      ...layout.nodes,
      H1: {
        type: { resolvedName: "Heading" },
        isCanvas: false,
        props: { text: "Title", level: 1 },
        nodes: [],
        linkedNodes: {},
        parent: "ROOT",
        hidden: false,
        custom: {},
      },
    };
    (layout.nodes.ROOT as { nodes: string[] }).nodes = ["H1"];

    const json = JSON.stringify(layoutToCraft(layout as SerializedLayout));
    expect(json).toContain("H1");
    expect(json).toContain("Title");
  });
});

describe("pickPreviewItem", () => {
  it("prefers the first published item", () => {
    expect(
      pickPreviewItem([sampleItem("pub")], [sampleItem("draft")]),
    ).toEqual(sampleItem("pub"));
  });

  it("falls back to the first draft item", () => {
    expect(pickPreviewItem([], [sampleItem("draft")])).toEqual(sampleItem("draft"));
  });

  it("returns null when no items exist", () => {
    expect(pickPreviewItem([], [])).toEqual(null);
  });
});
