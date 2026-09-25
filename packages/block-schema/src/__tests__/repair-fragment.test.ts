import { describe, it, expect } from "bun:test";
import { CURRENT_SCHEMA_VERSION, layoutHasContent, migrate, repairLayout } from "../index";

describe("repairLayout for reusable-block fragments", () => {
  it("preserves fragment node maps that have no CRAFT ROOT key", () => {
    const fragmentRoot = "frag-section-1";
    const layout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: fragmentRoot,
      nodes: {
        [fragmentRoot]: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          displayName: "Section",
          custom: {},
          parent: null,
          hidden: false,
          nodes: ["frag-heading-1"],
          linkedNodes: {},
        },
        "frag-heading-1": {
          type: { resolvedName: "Heading" },
          isCanvas: false,
          props: { text: "Hello reusable", level: 2 },
          displayName: "Heading",
          custom: {},
          parent: fragmentRoot,
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
      },
    };

    const repaired = repairLayout(layout);
    expect(repaired.root).toBe(fragmentRoot);
    expect(repaired.nodes[fragmentRoot]).toBeDefined();
    expect(repaired.nodes["frag-heading-1"]).toBeDefined();
    expect((repaired.nodes["frag-heading-1"] as { props: { text: string } }).props.text).toBe(
      "Hello reusable",
    );

    const migrated = migrate(layout);
    expect(migrated.nodes[fragmentRoot]).toBeDefined();
    expect(migrated.nodes["frag-heading-1"]).toBeDefined();
  });

  it("repairs reusable fragments saved with a missing CRAFT ROOT node", () => {
    const containerId = "frag-container-1";
    const headingId = "frag-heading-1";
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "ROOT",
      nodes: {
        [containerId]: {
          type: { resolvedName: "Container" },
          isCanvas: true,
          props: {},
          displayName: "Container",
          custom: {},
          parent: "ROOT",
          hidden: false,
          nodes: [headingId],
          linkedNodes: {},
        },
        [headingId]: {
          type: { resolvedName: "Heading" },
          isCanvas: false,
          props: { text: "Video section title", level: 2 },
          displayName: "Heading",
          custom: {},
          parent: containerId,
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
      },
    };

    const repaired = migrate(broken);
    expect(repaired.root).toBe(containerId);
    expect(repaired.nodes[containerId]?.parent).toBeNull();
    expect(layoutHasContent(repaired)).toBe(true);
  });
});
