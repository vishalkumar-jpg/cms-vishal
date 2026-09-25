import { describe, it, expect } from "bun:test";
import { CRAFT_ROOT, CURRENT_SCHEMA_VERSION, migrate, repairLayout, identifyChromeSlots } from "../index";
import type { SerializedLayout } from "../index";

const makeRoot = (children: string[], linkedNodes: Record<string, string> = {}): Record<string, any> => ({
  type: { resolvedName: "Section" },
  isCanvas: true,
  props: {},
  displayName: "Section",
  custom: {},
  parent: null,
  hidden: false,
  nodes: children,
  linkedNodes,
});

const makeNavbar = (id: string, parent: string): Record<string, any> => ({
  type: { resolvedName: "Navbar" },
  isCanvas: false,
  props: { logoText: "Office Beacon", logoUrl: "/ob-homepage", mode: "legacy" },
  displayName: "Navbar",
  custom: {},
  parent,
  hidden: false,
  nodes: [],
  linkedNodes: {},
});

const makeSection = (id: string, parent: string): Record<string, any> => ({
  type: { resolvedName: "Section" },
  isCanvas: true,
  props: { styles: { colors: { backgroundColor: "#ffffff" } } },
  displayName: "Section",
  custom: {},
  parent,
  hidden: false,
  nodes: [],
  linkedNodes: {},
});

describe("repairLayout reconnects orphaned ROOT children", () => {
  it("Case 1: reconnects an orphaned Navbar that has parent=ROOT but is not in ROOT.nodes", () => {
    const navbarId = "ob_nav_orphan_1";
    const sectionId = "ob_section_1";
    const layout: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: CRAFT_ROOT,
      nodes: {
        [CRAFT_ROOT]: makeRoot([sectionId]),
        [sectionId]: makeSection(sectionId, CRAFT_ROOT),
        [navbarId]: makeNavbar(navbarId, CRAFT_ROOT),
      },
    };

    const repaired = repairLayout(layout);
    const rootChildren = repaired.nodes[CRAFT_ROOT].nodes;

    expect(rootChildren).toContain(navbarId);
    expect(rootChildren).toContain(sectionId);
    expect(repaired.nodes[navbarId].parent).toBe(CRAFT_ROOT);

    const navs = Object.entries(repaired.nodes).filter(
      ([, n]: [string, any]) => n.type?.resolvedName === "Navbar",
    );
    expect(navs.length).toBe(1);
    expect(navs[0][0]).toBe(navbarId);
  });

  it("Case 2: does not duplicate an already-connected Navbar", () => {
    const navbarId = "ob_nav_connected_1";
    const sectionId = "ob_section_2";
    const layout: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: CRAFT_ROOT,
      nodes: {
        [CRAFT_ROOT]: makeRoot([navbarId, sectionId]),
        [sectionId]: makeSection(sectionId, CRAFT_ROOT),
        [navbarId]: makeNavbar(navbarId, CRAFT_ROOT),
      },
    };

    const repaired = repairLayout(layout);
    const rootChildren = repaired.nodes[CRAFT_ROOT].nodes;

    expect(rootChildren.filter((id: string) => id === navbarId).length).toBe(1);
    expect(rootChildren).toEqual([navbarId, sectionId]);

    const navs = Object.entries(repaired.nodes).filter(
      ([, n]: [string, any]) => n.type?.resolvedName === "Navbar",
    );
    expect(navs.length).toBe(1);
  });

  it("Case 3: is idempotent — running repair twice yields identical ROOT.nodes", () => {
    const navbarId = "ob_nav_orphan_3";
    const sectionId = "ob_section_3";
    const layout: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: CRAFT_ROOT,
      nodes: {
        [CRAFT_ROOT]: makeRoot([sectionId]),
        [sectionId]: makeSection(sectionId, CRAFT_ROOT),
        [navbarId]: makeNavbar(navbarId, CRAFT_ROOT),
      },
    };

    const once = repairLayout(layout);
    const twice = repairLayout(once);

    expect(once.nodes[CRAFT_ROOT].nodes).toEqual(twice.nodes[CRAFT_ROOT].nodes);
    expect(once.nodes[CRAFT_ROOT].nodes).toContain(navbarId);
    expect(twice.nodes[CRAFT_ROOT].nodes).toContain(navbarId);

    const navsAfterTwice = Object.entries(twice.nodes).filter(
      ([, n]: [string, any]) => n.type?.resolvedName === "Navbar",
    );
    expect(navsAfterTwice.length).toBe(1);
  });

  it("Case 4: does not reconnect unrelated fragment nodes (no ROOT key)", () => {
    const containerId = "frag-container";
    const headingId = "frag-heading";
    const layout: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: containerId,
      nodes: {
        [containerId]: {
          type: { resolvedName: "Container" },
          isCanvas: true,
          props: {},
          displayName: "Container",
          custom: {},
          parent: null,
          hidden: false,
          nodes: [headingId],
          linkedNodes: {},
        },
        [headingId]: {
          type: { resolvedName: "Heading" },
          isCanvas: false,
          props: { text: "Test", level: 2 },
          displayName: "Heading",
          custom: {},
          parent: containerId,
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
      },
    };

    const repaired = repairLayout(layout);
    expect(repaired.root).toBe(containerId);
    expect(repaired.nodes[containerId].parent).toBeNull();
    expect(repaired.nodes[containerId].nodes).toEqual([headingId]);
  });

  it("Case 4b: reconnects multiple orphaned ROOT children preserving order", () => {
    const navbarId = "ob_nav_multi_1";
    const sectionId = "ob_section_multi";
    const anotherSection = "ob_section_multi_2";
    const layout: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: CRAFT_ROOT,
      nodes: {
        [CRAFT_ROOT]: makeRoot([sectionId]),
        [sectionId]: makeSection(sectionId, CRAFT_ROOT),
        [anotherSection]: makeSection(anotherSection, CRAFT_ROOT),
        [navbarId]: makeNavbar(navbarId, CRAFT_ROOT),
      },
    };

    const repaired = repairLayout(layout);
    const rootChildren = repaired.nodes[CRAFT_ROOT].nodes;

    expect(rootChildren).toEqual([
      sectionId,
      anotherSection,
      navbarId,
    ]);
    expect(rootChildren.filter((id: string) => id === navbarId).length).toBe(1);
    expect(rootChildren.filter((id: string) => id === anotherSection).length).toBe(1);
    expect(navbarId).not.toBe(anotherSection);
  });

  it("Case 5: after repair, identifyChromeSlots finds the previously-orphaned Navbar", () => {
    const navbarId = "ob_nav_orphan_5";
    const sectionId = "ob_section_5";
    const layout: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: CRAFT_ROOT,
      nodes: {
        [CRAFT_ROOT]: makeRoot([sectionId]),
        [sectionId]: makeSection(sectionId, CRAFT_ROOT),
        [navbarId]: makeNavbar(navbarId, CRAFT_ROOT),
      },
    };

    const repaired = migrate(layout);
    const slots = identifyChromeSlots(repaired);

    expect(slots.navbarId).toBe(navbarId);

    const rootChildren = repaired.nodes[CRAFT_ROOT].nodes;
    expect(rootChildren).toContain(navbarId);

    const navsAfterRepair = Object.entries(repaired.nodes).filter(
      ([, n]: [string, any]) => n.type?.resolvedName === "Navbar",
    );
    expect(navsAfterRepair.length).toBe(1);
    expect(navsAfterRepair[0][0]).toBe(navbarId);
  });

  it("Case 6: does not reconnect a node owned via ROOT.linkedNodes", () => {
    const navbarId = "ob_nav_linked_1";
    const sectionId = "ob_section_6";
    const layout: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: CRAFT_ROOT,
      nodes: {
        /* ROOT claims the Navbar through linkedNodes, NOT through nodes */
        [CRAFT_ROOT]: makeRoot([sectionId], { navbar: navbarId }),
        [sectionId]: makeSection(sectionId, CRAFT_ROOT),
        [navbarId]: makeNavbar(navbarId, CRAFT_ROOT),
      },
    };

    const repaired = repairLayout(layout);
    const rootChildren = repaired.nodes[CRAFT_ROOT].nodes;
    const rootLinkedNodes = repaired.nodes[CRAFT_ROOT].linkedNodes;

    /* The linked node must NOT be appended to ROOT.nodes */
    expect(rootChildren).not.toContain(navbarId);
    expect(rootChildren).toEqual([sectionId]);

    /* The linked node must remain in ROOT.linkedNodes */
    expect(Object.values(rootLinkedNodes)).toContain(navbarId);
    expect(repaired.nodes[CRAFT_ROOT].linkedNodes.navbar).toBe(navbarId);

    /* Parent must still point at CRAFT_ROOT */
    expect(repaired.nodes[navbarId].parent).toBe(CRAFT_ROOT);

    /* Exactly one Navbar */
    const navs = Object.entries(repaired.nodes).filter(
      ([, n]: [string, any]) => n.type?.resolvedName === "Navbar",
    );
    expect(navs.length).toBe(1);
    expect(navs[0][0]).toBe(navbarId);
  });
});
