import { describe, it, expect } from "bun:test";
import {
  mergeComponentProps,
  applyComponentBindings,
  resolveComponentInstance,
  collectSlots,
} from "../component";
import type { ResolvedComponent } from "../component";
import type { SerializedLayout } from "../layout";

/**
 * COMPONENTS — pure resolution contract shared by the renderer + admin preview.
 * Covers prop merge precedence (defaults < variant < overrides), componentBinding
 * folding, slot-content splicing, and backward-compat (a plain reusable block
 * with no props/slots resolves to its layout unchanged).
 */

describe("mergeComponentProps", () => {
  const props = [
    { key: "title", type: "text" as const, default: "Default" },
    { key: "tone", type: "select" as const, default: "light" },
  ];
  const variants = [{ name: "dark", values: { tone: "dark" } }];

  it("starts from declared defaults", () => {
    expect(mergeComponentProps(props, undefined, [], undefined)).toEqual({
      title: "Default",
      tone: "light",
    });
  });

  it("applies the variant over defaults, then overrides over the variant", () => {
    const merged = mergeComponentProps(props, "dark", variants, { title: "Hi" });
    expect(merged).toEqual({ title: "Hi", tone: "dark" });
  });

  it("ignores undefined overrides (keeps default/variant)", () => {
    const merged = mergeComponentProps(props, "dark", variants, { tone: undefined });
    expect(merged.tone).toBe("dark");
  });
});

describe("applyComponentBindings", () => {
  it("overrides a bound prop from the merged values", () => {
    const out = applyComponentBindings({ text: "static" }, { text: "title" }, { title: "Bound" });
    expect(out).toEqual({ text: "Bound" });
  });
  it("falls back to the static prop when the value is empty/missing", () => {
    expect(applyComponentBindings({ text: "s" }, { text: "title" }, { title: "" })).toEqual({ text: "s" });
    expect(applyComponentBindings({ text: "s" }, { text: "missing" }, {})).toEqual({ text: "s" });
  });
  it("is identity with no binding (backward-compatible)", () => {
    const props = { text: "s" };
    expect(applyComponentBindings(props, undefined, { title: "x" })).toBe(props);
  });
});

const component = (): ResolvedComponent => ({
  props: [{ key: "title", type: "text", default: "Default Title" }],
  variants: [{ name: "promo", values: { title: "Promo Title" } }],
  layout: {
    schemaVersion: "2.0",
    root: "ROOT",
    nodes: {
      ROOT: { type: { resolvedName: "Section" }, isCanvas: true, props: {}, nodes: ["H", "S"], linkedNodes: {}, parent: null, hidden: false, custom: {} },
      // Heading bound to the `title` component prop.
      H: { type: { resolvedName: "Heading" }, isCanvas: false, props: { text: "fallback", level: 2 }, componentBinding: { text: "title" }, nodes: [], linkedNodes: {}, parent: "ROOT", hidden: false, custom: {} },
      // A named slot with default content.
      S: { type: { resolvedName: "Div" }, isCanvas: true, props: {}, isSlot: true, slotName: "body", nodes: ["D"], linkedNodes: {}, parent: "ROOT", hidden: false, custom: {} },
      D: { type: { resolvedName: "Paragraph" }, isCanvas: false, props: { text: "slot default" }, nodes: [], linkedNodes: {}, parent: "S", hidden: false, custom: {} },
    },
  } as unknown as SerializedLayout,
});

describe("collectSlots", () => {
  it("finds named slot nodes", () => {
    expect(collectSlots(component().layout)).toEqual([{ name: "body", nodeId: "S" }]);
  });
});

describe("resolveComponentInstance", () => {
  it("folds the prop default into the bound node (no overrides)", () => {
    const out = resolveComponentInstance(component(), undefined);
    expect(out.nodes.H.props.text).toBe("Default Title");
    // Authoring-only fields are stripped from the resolved layout.
    expect((out.nodes.H as Record<string, unknown>).componentBinding).toBeUndefined();
    expect((out.nodes.S as Record<string, unknown>).isSlot).toBeUndefined();
  });

  it("applies a variant then a per-instance override to the bound prop", () => {
    const variant = resolveComponentInstance(component(), { variant: "promo" });
    expect(variant.nodes.H.props.text).toBe("Promo Title");
    const override = resolveComponentInstance(component(), {
      variant: "promo",
      propOverrides: { title: "Instance Title" },
    });
    expect(override.nodes.H.props.text).toBe("Instance Title");
  });

  it("keeps the slot's default content when no slotContent is given", () => {
    const out = resolveComponentInstance(component(), undefined);
    expect(out.nodes.S.nodes).toEqual(["D"]);
    expect(out.nodes.D.props.text).toBe("slot default");
  });

  it("splices the instance's slot content under namespaced ids", () => {
    const slotContent: SerializedLayout = {
      schemaVersion: "2.0",
      root: "R",
      nodes: {
        R: { type: { resolvedName: "Paragraph" }, isCanvas: false, props: { text: "filled slot" }, nodes: [], linkedNodes: {}, parent: null, hidden: false, custom: {} },
      },
    } as unknown as SerializedLayout;
    const out = resolveComponentInstance(component(), { slotContent: { body: slotContent } });
    const slotChild = out.nodes.S.nodes[0];
    expect(slotChild).toBe("__slot_body__R");
    expect(out.nodes[slotChild].props.text).toBe("filled slot");
    expect(out.nodes[slotChild].parent).toBe("S");
    // The default slot child is gone.
    expect(out.nodes.D).toBeUndefined();
  });

  it("resolves a plain reusable block (no props/slots) unchanged (backward-compat)", () => {
    const plain: ResolvedComponent = {
      layout: {
        schemaVersion: "2.0",
        root: "ROOT",
        nodes: {
          ROOT: { type: { resolvedName: "Section" }, isCanvas: true, props: {}, nodes: ["P"], linkedNodes: {}, parent: null, hidden: false, custom: {} },
          P: { type: { resolvedName: "Paragraph" }, isCanvas: false, props: { text: "hi" }, nodes: [], linkedNodes: {}, parent: "ROOT", hidden: false, custom: {} },
        },
      } as unknown as SerializedLayout,
    };
    const out = resolveComponentInstance(plain, undefined);
    expect(out).toEqual(plain.layout);
  });
});
