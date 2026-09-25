import { describe, it, expect } from "bun:test";
import { CURRENT_SCHEMA_VERSION, layoutHasContent, migrate, repairLayout } from "../index";

describe("layoutHasContent", () => {
  it("returns false for an empty section fragment", () => {
    const sectionId = "sec-1";
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
          nodes: [],
          linkedNodes: {},
          custom: {},
        },
      },
    };
    expect(layoutHasContent(layout)).toBe(false);
  });

  it("returns true for a navbar with legacy navItems", () => {
    const navId = "nav-1";
    const layout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: navId,
      nodes: {
        [navId]: {
          type: { resolvedName: "Navbar" },
          isCanvas: true,
          props: {
            mode: "composed",
            navItems: [{ label: "Home", url: "/" }],
          },
          displayName: "Navbar",
          parent: null,
          hidden: false,
          nodes: [],
          linkedNodes: {},
          custom: {},
        },
      },
    };
    expect(layoutHasContent(layout)).toBe(true);
  });
});

describe("repairLayout navbar legacy normalization", () => {
  it("forces legacy mode when navItems exist without canvas children", () => {
    const navId = "nav-1";
    const layout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: navId,
      nodes: {
        [navId]: {
          type: { resolvedName: "Navbar" },
          isCanvas: true,
          props: {
            mode: "composed",
            navItems: [{ label: "Solutions", url: "/solutions" }],
          },
          displayName: "Navbar",
          parent: null,
          hidden: false,
          nodes: [],
          linkedNodes: {},
          custom: {},
        },
      },
    };
    const repaired = repairLayout(layout);
    const nav = repaired.nodes[navId] as { props?: { mode?: string } };
    expect(nav.props?.mode).toBe("legacy");
    expect(layoutHasContent(repaired)).toBe(true);
  });

  it("fills missing logoImageHeight when a logo image is set", () => {
    const navId = "nav-1";
    const layout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: navId,
      nodes: {
        [navId]: {
          type: { resolvedName: "Navbar" },
          isCanvas: false,
          props: {
            logoImage: "https://example.com/logo.png",
            navItems: [{ label: "Home", url: "/" }],
          },
          displayName: "Navbar",
          parent: null,
          hidden: false,
          nodes: [],
          linkedNodes: {},
          custom: {},
        },
      },
    };
    const repaired = repairLayout(layout);
    const nav = repaired.nodes[navId] as { props?: { logoImageHeight?: number } };
    expect(nav.props?.logoImageHeight).toBe(38);
  });
});
