import { describe, expect, it } from "bun:test";
import { CURRENT_SCHEMA_VERSION, layoutHasContent } from "@ob-cms/block-schema";
import {
  craftJsonToFragmentLayout,
  layoutToFragmentEditorJson,
} from "../fragmentEditorLayout";

describe("craftJsonToFragmentLayout", () => {
  it("preserves authored content when stripping editor RootFrame", () => {
    const sectionId = "sec1";
    const headingId = "h1";
    const layout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: sectionId,
      nodes: {
        [sectionId]: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          displayName: "Section",
          parent: null,
          hidden: false,
          nodes: [headingId],
          linkedNodes: {},
          custom: {},
        },
        [headingId]: {
          type: { resolvedName: "Heading" },
          isCanvas: false,
          props: { text: "Video section title", level: 2 },
          displayName: "Heading",
          parent: sectionId,
          hidden: false,
          nodes: [],
          linkedNodes: {},
          custom: {},
        },
      },
    };

    const editorJson = layoutToFragmentEditorJson(layout);
    const saved = craftJsonToFragmentLayout(editorJson);

    expect(saved.root).not.toBe("ROOT");
    expect(saved.nodes[saved.root]).toBeDefined();
    expect(layoutHasContent(saved)).toBe(true);
  });
});
