import { describe, expect, it } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import type { SerializedLayout } from "@ob-cms/block-schema";
import {
  extractBandLayoutByIndex,
  extractSubtreeFromLayout,
  listTopLevelBandNodeIds,
  prepareStarterSectionLayout,
} from "../layoutSectionExtract";

function samplePageLayout(): SerializedLayout {
  const base = emptyLayout();
  const bandA = "band_a";
  const bandB = "band_b";
  const heading = "heading_a";
  return {
    schemaVersion: base.schemaVersion,
    root: base.root,
    nodes: {
      ...base.nodes,
      ROOT: {
        ...base.nodes[base.root]!,
        nodes: [bandA, bandB],
      },
      [bandA]: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        displayName: "Hero",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [heading],
        linkedNodes: {},
      },
      [heading]: {
        type: { resolvedName: "Heading" },
        isCanvas: false,
        props: { text: "Hero title" },
        displayName: "Heading",
        custom: {},
        parent: bandA,
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      [bandB]: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        displayName: "FAQ",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
    },
  };
}

function layoutWithLinkedNodes(): SerializedLayout {
  const base = samplePageLayout();
  return {
    ...base,
    nodes: {
      ...base.nodes,
      linked_child: {
        type: { resolvedName: "Text" },
        isCanvas: false,
        props: { text: "Linked" },
        displayName: "Text",
        custom: {},
        parent: "band_a",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      band_a: {
        ...base.nodes.band_a!,
        linkedNodes: { slot: "linked_child" },
      },
    },
  };
}

function layoutWithSharedChild(): SerializedLayout {
  const base = samplePageLayout();
  return {
    ...base,
    nodes: {
      ...base.nodes,
      shared_child: {
        type: { resolvedName: "Text" },
        isCanvas: false,
        props: { text: "Shared" },
        displayName: "Text",
        custom: {},
        parent: "band_a",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      band_a: {
        ...base.nodes.band_a!,
        nodes: ["shared_child"],
      },
      band_b: {
        ...base.nodes.band_b!,
        nodes: ["shared_child"],
      },
    },
  };
}

describe("layoutSectionExtract", () => {
  it("lists top-level band ids from page layout ROOT", () => {
    expect(listTopLevelBandNodeIds(samplePageLayout())).toEqual(["band_a", "band_b"]);
  });

  it("extracts a subtree fragment with detached root", () => {
    const fragment = extractSubtreeFromLayout(samplePageLayout(), "band_a");
    expect(fragment.root).toBe("band_a");
    expect(fragment.nodes.band_a?.parent).toEqual(null);
    expect(fragment.nodes.heading_a).toBeDefined();
    expect("band_b" in fragment.nodes).toBe(false);
  });

  it("extracts a band by index with a detached root", () => {
    const wrapped = extractBandLayoutByIndex(samplePageLayout(), 0);
    expect(wrapped.root).toBe("band_a");
    expect(wrapped.nodes.band_a?.parent).toEqual(null);
  });

  it("prepareStarterSectionLayout wraps under ROOT and regenerates ids", () => {
    const prepared = prepareStarterSectionLayout(samplePageLayout(), 0);
    expect(prepared.root).toBe("ROOT");
    const root = prepared.nodes.ROOT;
    expect(root?.nodes?.length).toEqual(1);
    const childId = root?.nodes?.[0];
    expect(childId).toBeDefined();
    expect(prepared.nodes[childId!]?.parent).toBe("ROOT");
    expect(childId).not.toBe("band_a");
  });

  it("throws when band index is out of range", () => {
    expect(() => extractBandLayoutByIndex(samplePageLayout(), 9)).toThrow(
      "Band index 9 is out of range (2 bands)",
    );
  });

  it("collects linkedNodes during subtree extraction", () => {
    const fragment = extractSubtreeFromLayout(layoutWithLinkedNodes(), "band_a");
    expect(fragment.nodes.linked_child).toBeDefined();
    expect(fragment.nodes.linked_child?.parent).toBe("band_a");
  });

  it("terminates when the same child id appears under two parents", () => {
    const fragment = extractSubtreeFromLayout(layoutWithSharedChild(), "band_a");
    expect(fragment.nodes.shared_child?.parent).toBe("band_a");
    expect(Object.keys(fragment.nodes)).toHaveLength(2);
  });
});
