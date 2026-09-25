import { describe, it, expect } from "bun:test";
import {
  replaceReusableBlockReferences,
  scrubReusableBlockReferences,
} from "../scrub-reusable-refs";

const layoutWithRef = (ref: string) => ({
  schemaVersion: "2.0",
  root: "ROOT",
  nodes: {
    ROOT: {
      type: { resolvedName: "Section" },
      isCanvas: true,
      props: {},
      displayName: "Section",
      parent: null,
      hidden: false,
      nodes: ["ref"],
      linkedNodes: {},
      custom: {},
    },
    ref: {
      type: { resolvedName: "Reusable Block" },
      isCanvas: false,
      props: { reusableBlockId: ref },
      displayName: "Reusable Block",
      parent: "ROOT",
      hidden: false,
      nodes: [],
      linkedNodes: {},
      custom: {},
    },
  },
});

describe("replaceReusableBlockReferences", () => {
  it("swaps a stale reusable block id", () => {
    const updated = replaceReusableBlockReferences(
      layoutWithRef("rub_old"),
      "rub_old",
      "rub_new",
    );
    expect(updated?.nodes.ref.props).toEqual({ reusableBlockId: "rub_new" });
  });

  it("scrub removes nodes entirely", () => {
    const scrubbed = scrubReusableBlockReferences(layoutWithRef("rub_old"), "rub_old");
    expect(scrubbed?.nodes.ROOT.nodes).toEqual([]);
    expect(scrubbed?.nodes.ref).toBeUndefined();
  });
});
