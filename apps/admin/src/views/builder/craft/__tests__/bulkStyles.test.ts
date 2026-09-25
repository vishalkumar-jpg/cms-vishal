import { describe, it, expect } from "bun:test";
import {
  findRepeaterAncestor,
  findSimilarStyleTargets,
  readStyleSnapshot,
  applyStylesToSimilar,
} from "../../craft/bulkStyles";

/** Mock Craft node stored in the test fixture (props optional for layout-only nodes). */
type MockNodeDef = {
  parent?: string | null;
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
};

type MockNodes = Record<string, MockNodeDef>;

/** Minimal Craft query stub for unit tests. */
const mockQuery = (nodes: MockNodes) => {
  const get = (id: string) => {
    const n = nodes[id];
    if (!n) throw new Error(`missing ${id}`);
    return {
      data: {
        parent: n.parent ?? null,
        nodes: n.children ?? [],
        props: n.props ?? {},
        custom: {},
      },
    };
  };
  return {
    getNodes: () => nodes,
    node: (id: string) => ({
      get: () => get(id),
      toSerializedNode: () => ({ type: { resolvedName: nodes[id]?.type } }),
    }),
  };
};

describe("bulkStyles — similar targets", () => {
  const nodes: MockNodes = {
    ROOT: { parent: null, type: "Root", children: ["grid"] },
    grid: { parent: "ROOT", type: "Grid", children: ["c1", "c2", "c3"] },
    c1: { parent: "grid", type: "Div", props: { styles: { colors: { textColor: "#111" } } } },
    c2: { parent: "grid", type: "Div", props: { styles: {} } },
    c3: { parent: "grid", type: "Heading", props: { styles: {} } },
    rep: { parent: "ROOT", type: "Repeater", children: ["card"] },
    card: { parent: "rep", type: "Div", children: ["t1", "t2"] },
    t1: { parent: "card", type: "Heading", props: { styles: { colors: { textColor: "red" } } } },
    t2: { parent: "card", type: "Heading", props: { styles: {} } },
    lone: { parent: "ROOT", type: "Div", props: { styles: {} } },
  };

  const query = mockQuery(nodes) as unknown as Parameters<typeof findSimilarStyleTargets>[0];

  it("finds sibling cards with the same block type", () => {
    const t = findSimilarStyleTargets(query, "c1");
    expect(t.siblings).toEqual(["c2"]);
    expect(t.allSimilar).toContain("c2");
    expect(t.allSimilar).toContain("lone");
    expect(t.allSimilar).not.toContain("c3");
  });

  it("finds repeater template peers", () => {
    expect(findRepeaterAncestor(query, "t1")).toBe("rep");
    const t = findSimilarStyleTargets(query, "t1");
    expect(t.repeaterPeers).toEqual(["t2"]);
  });

  it("copies styles onto sibling targets", () => {
    const actions = {
      setProp: (id: string, fn: (p: Record<string, unknown>) => void) => {
        const node = nodes[id];
        if (!node) throw new Error(`missing ${id}`);
        const props = { ...(node.props ?? {}) };
        fn(props);
        node.props = props;
      },
    };
    const allowed = () => true;
    const n = applyStylesToSimilar(
      query,
      actions as unknown as Parameters<typeof applyStylesToSimilar>[1],
      "c1",
      "siblings",
      "styles",
      allowed,
    );
    expect(n).toBe(1);
    expect(nodes.c2.props?.styles).toEqual({ colors: { textColor: "#111" } });
  });

  it("reads a style snapshot from the source node", () => {
    const snap = readStyleSnapshot(query, "c1", "styles");
    expect(snap).toEqual({ colors: { textColor: "#111" } });
  });
});
