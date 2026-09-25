import { describe, expect, it } from "bun:test";
import { layoutToCraft } from "../serialize";
import { selectionToSectionTemplateLayout } from "../nodeOps";

type SerializedNode = {
  type: { resolvedName: string };
  isCanvas: boolean;
  props: Record<string, unknown>;
  displayName: string;
  custom: Record<string, unknown>;
  parent: string | null;
  hidden: boolean;
  nodes: string[];
  linkedNodes: Record<string, string>;
};

const node = (
  type: string,
  parent: string | null,
  childIds: string[] = [],
): SerializedNode => ({
  type: { resolvedName: type },
  isCanvas: childIds.length > 0,
  props: {},
  displayName: type,
  custom: {},
  parent,
  hidden: false,
  nodes: childIds,
  linkedNodes: {},
});

/** Minimal Craft query mock for ROOT → Hero, Features, Footer. */
const mockPageQuery = () => {
  const nodes: Record<string, SerializedNode> = {
    ROOT: node("Section", null, ["hero", "features", "footer"]),
    hero: node("Section", "ROOT"),
    features: node("Section", "ROOT", ["feature-heading"]),
    "feature-heading": node("Heading", "features"),
    footer: node("Section", "ROOT"),
  };

  const collectSubtree = (rootId: string): Record<string, SerializedNode> => {
    const out: Record<string, SerializedNode> = {};
    const visit = (id: string): void => {
      if (out[id]) return;
      out[id] = nodes[id];
      for (const childId of nodes[id].nodes) visit(childId);
      for (const linkedId of Object.values(nodes[id].linkedNodes)) visit(linkedId);
    };
    visit(rootId);
    return out;
  };

  return {
    node: (id: string) => ({
      toNodeTree: () => ({
        rootNodeId: id,
        nodes: Object.fromEntries(
          Object.keys(collectSubtree(id)).map((subId) => [subId, { id: subId }]),
        ),
      }),
      toSerializedNode: () => nodes[id],
    }),
    serialize: () => JSON.stringify(nodes),
  };
};

describe("selectionToSectionTemplateLayout", () => {
  it("saves only the selected subtree under synthetic ROOT (excludes Hero/Footer)", () => {
    const query = mockPageQuery();
    const layout = selectionToSectionTemplateLayout(query as never, "features");

    expect(layout.root).toBe("ROOT");
    expect(Object.keys(layout.nodes).sort()).toEqual(
      ["ROOT", "feature-heading", "features"].sort(),
    );
    expect(layout.nodes.ROOT?.nodes).toEqual(["features"]);
    expect(layout.nodes.features?.displayName).toBe("Section");
    expect("hero" in layout.nodes).toBe(false);
    expect("footer" in layout.nodes).toBe(false);
  });

  it("produces an insertable layout whose ROOT child is the selected block", () => {
    const query = mockPageQuery();
    const layout = selectionToSectionTemplateLayout(query as never, "features");
    const craftMap = layoutToCraft(layout);
    const root = craftMap.ROOT as { nodes?: string[] };

    expect(root.nodes).toEqual(["features"]);
    expect(craftMap.features).toBeDefined();
    expect("hero" in craftMap).toBe(false);
    expect("footer" in craftMap).toBe(false);
  });

  it("full-page craftToLayout would still include unrelated siblings", () => {
    const query = mockPageQuery();
    const full = JSON.parse(query.serialize()) as Record<string, SerializedNode>;

    expect(Object.keys(full).sort()).toEqual(["ROOT", "feature-heading", "features", "footer", "hero"]);
    expect(full.ROOT.nodes).toEqual(["hero", "features", "footer"]);
  });
});
