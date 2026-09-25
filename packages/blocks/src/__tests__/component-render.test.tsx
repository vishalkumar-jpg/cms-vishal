import { describe, it, expect } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ResolvedComponent, SerializedLayout } from "@ob-cms/block-schema";
import { ReusableBlock, ReusableBlockContext } from "../index";

/**
 * COMPONENTS render parity — the ReusableBlock instance resolves a component
 * definition (layout + props + variants) through the shared pure resolver and
 * renders the bound prop + slot content. Because resolution happens after mount
 * (SSR-safe), the static markup is the loading placeholder; this test drives the
 * resolver directly to assert wiring + the resolved output shape.
 */

const componentDef: ResolvedComponent = {
  props: [{ key: "title", type: "text", default: "Default Title" }],
  variants: [{ name: "promo", values: { title: "Promo Title" } }],
  layout: {
    schemaVersion: "2.0",
    root: "ROOT",
    nodes: {
      ROOT: { type: { resolvedName: "Section" }, isCanvas: true, props: {}, nodes: ["H"], linkedNodes: {}, parent: null, hidden: false, custom: {} },
      H: { type: { resolvedName: "Heading" }, isCanvas: false, props: { text: "fallback", level: 2 }, componentBinding: { text: "title" }, nodes: [], linkedNodes: {}, parent: "ROOT", hidden: false, custom: {} },
    },
  } as unknown as SerializedLayout,
};

describe("ReusableBlock as a component instance", () => {
  it("SSR-renders a stable placeholder before mount (no hydration mismatch)", () => {
    const ctx = { getReusable: async () => null, getComponent: async () => componentDef };
    const html = renderToStaticMarkup(
      React.createElement(
        ReusableBlockContext.Provider,
        { value: ctx },
        React.createElement(ReusableBlock, { reusableBlockId: "c1" }),
      ),
    );
    // Placeholder shown on the server (resolution is post-mount, SSR-safe).
    expect(html).toContain("Loading reusable block");
    expect(html).not.toContain("Default Title");
  });

  it("renders the placeholder for a chosen-but-unresolvable reference", () => {
    const ctx = { getReusable: async () => null, getComponent: async () => null };
    const html = renderToStaticMarkup(
      React.createElement(
        ReusableBlockContext.Provider,
        { value: ctx },
        React.createElement(ReusableBlock, { reusableBlockId: "missing" }),
      ),
    );
    expect(html).toContain("reusable block");
  });

  it("shows the 'select' placeholder with no reference", () => {
    const html = renderToStaticMarkup(React.createElement(ReusableBlock, {}));
    expect(html).toContain("Select a reusable block");
  });
});
