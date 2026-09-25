import { describe, it, expect } from "bun:test";
import {
  CURRENT_SCHEMA_VERSION,
  unwrapPassthroughFragment,
  isIntrinsicWidthFragmentRoot,
  migrate,
  type SerializedLayout,
} from "../index";

const buttonLayout = (): SerializedLayout =>
  migrate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: "btn",
    nodes: {
      btn: {
        type: { resolvedName: "Button" },
        props: { label: "Start Your Transformation" },
        nodes: [],
        linkedNodes: {},
        parent: null,
      },
    },
  });

describe("unwrapPassthroughFragment", () => {
  it("promotes a lone button out of a default Section wrapper", () => {
    const wrapped = migrate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "sec",
      nodes: {
        sec: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          nodes: ["btn"],
          linkedNodes: {},
          parent: null,
        },
        btn: {
          type: { resolvedName: "Button" },
          props: { label: "CTA" },
          nodes: [],
          linkedNodes: {},
          parent: "sec",
        },
      },
    });

    const out = unwrapPassthroughFragment(wrapped);
    expect(out.root).toBe("btn");
    expect(out.nodes.btn.type.resolvedName).toBe("Button");
    expect(out.nodes.sec).toBeUndefined();
  });

  it("keeps a Section when it has custom spacing", () => {
    const wrapped = migrate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "sec",
      nodes: {
        sec: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: { styles: { spacing: { paddingTop: "48px" } } },
          nodes: ["btn"],
          linkedNodes: {},
          parent: null,
        },
        btn: {
          type: { resolvedName: "Button" },
          props: { label: "CTA" },
          nodes: [],
          linkedNodes: {},
          parent: "sec",
        },
      },
    });

    const out = unwrapPassthroughFragment(wrapped);
    expect(out.root).toBe("sec");
  });

  it("unwraps Section > Container > Button chains", () => {
    const wrapped = migrate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "sec",
      nodes: {
        sec: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          nodes: ["box"],
          linkedNodes: {},
          parent: null,
        },
        box: {
          type: { resolvedName: "Container" },
          isCanvas: true,
          props: {},
          nodes: ["btn"],
          linkedNodes: {},
          parent: "sec",
        },
        btn: {
          type: { resolvedName: "Button" },
          props: { label: "CTA" },
          nodes: [],
          linkedNodes: {},
          parent: "box",
        },
      },
    });

    const out = unwrapPassthroughFragment(wrapped);
    expect(out.root).toBe("btn");
  });
});

describe("isIntrinsicWidthFragmentRoot", () => {
  it("treats a button root as intrinsic", () => {
    expect(isIntrinsicWidthFragmentRoot(buttonLayout())).toBe(true);
  });

  it("treats a section root as full width", () => {
    const section = migrate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "sec",
      nodes: {
        sec: {
          type: { resolvedName: "Section" },
          props: {},
          nodes: [],
          linkedNodes: {},
          parent: null,
        },
      },
    });
    expect(isIntrinsicWidthFragmentRoot(section)).toBe(false);
  });
});
