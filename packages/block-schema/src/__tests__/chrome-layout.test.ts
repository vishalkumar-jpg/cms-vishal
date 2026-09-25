import { describe, it, expect } from "bun:test";
import { CURRENT_SCHEMA_VERSION } from "../layout";
import { migrate } from "../migrate";
import {
  composePageWithHomepageChrome,
  identifyChromeSlots,
  normalizeChromeOrder,
  stripChromeFromLayout,
  type SerializedLayout,
} from "../chrome-layout";

function section(id: string, bg: string, parent = "ROOT"): SerializedLayout["nodes"][string] {
  return {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: { styles: { colors: { backgroundColor: bg } } },
    displayName: "Section",
    parent,
    hidden: false,
    nodes: [],
    linkedNodes: {},
    custom: {},
  };
}

function navbar(id: string, parent = "ROOT"): SerializedLayout["nodes"][string] {
  return {
    type: { resolvedName: "Navbar" },
    isCanvas: true,
    props: {},
    displayName: "Navbar",
    parent,
    hidden: false,
    nodes: [],
    linkedNodes: {},
    custom: {},
  };
}

function bodySection(id: string, parent = "ROOT"): SerializedLayout["nodes"][string] {
  return section(id, "#ffffff", parent);
}

function homepageLayout(): SerializedLayout {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: "ROOT",
    nodes: {
      ROOT: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        displayName: "Section",
        parent: null,
        hidden: false,
        nodes: ["top", "nav", "body", "foot"],
        linkedNodes: {},
        custom: {},
      },
      top: section("top", "#147eff"),
      nav: navbar("nav"),
      body: bodySection("body"),
      foot: section("foot", "#002244"),
    },
  };
}

describe("chrome-layout", () => {
  it("identifies topbar, navbar, footer, and body slots", () => {
    const slots = identifyChromeSlots(homepageLayout());
    expect(slots.topbarId).toBe("top");
    expect(slots.navbarId).toBe("nav");
    expect(slots.footerId).toBe("foot");
    expect(slots.bodyIds).toEqual(["body"]);
  });

  it("composes homepage chrome onto a child page body", () => {
    const child: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "ROOT",
      nodes: {
        ROOT: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          displayName: "Section",
          parent: null,
          hidden: false,
          nodes: ["child-body"],
          linkedNodes: {},
          custom: {},
        },
        "child-body": bodySection("child-body"),
      },
    };

    const composed = composePageWithHomepageChrome(child, homepageLayout(), {}, "how-it-works");
    const slots = identifyChromeSlots(composed);
    expect(slots.bodyIds).toEqual(["child-body"]);
    expect(slots.topbarId).toBeDefined();
    expect(slots.navbarId).toBeDefined();
    expect(slots.footerId).toBeDefined();
    expect(composed.nodes[slots.topbarId!]?.props).toEqual(
      homepageLayout().nodes.top.props,
    );
  });

  it("strips duplicate chrome from child layouts before composing", () => {
    const childWithChrome: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "ROOT",
      nodes: {
        ...homepageLayout().nodes,
        "child-body": bodySection("child-body"),
        ROOT: {
          ...homepageLayout().nodes.ROOT,
          nodes: ["top", "nav", "child-body", "foot"],
        },
      },
    };

    const composed = composePageWithHomepageChrome(
      childWithChrome,
      homepageLayout(),
      {},
      "how-it-works",
    );
    const slots = identifyChromeSlots(composed);
    expect(slots.bodyIds).toEqual(["child-body"]);
  });

  it("hides chrome slots when hide flags are set", () => {
    const composed = composePageWithHomepageChrome(
      homepageLayout(),
      null,
      { hideFooter: true, hideTopbar: true },
      "ob-homepage",
    );
    const slots = identifyChromeSlots(composed);
    expect(slots.topbarId).toBeUndefined();
    expect(slots.footerId).toBeUndefined();
    expect(slots.navbarId).toBe("nav");
  });

  it("stripChromeFromLayout keeps only body sections", () => {
    const stripped = stripChromeFromLayout(homepageLayout());
    const slots = identifyChromeSlots(stripped);
    expect(slots.bodyIds).toEqual(["body"]);
    expect(slots.topbarId).toBeUndefined();
    expect(slots.navbarId).toBeUndefined();
    expect(slots.footerId).toBeUndefined();
  });

  it("stripChromeFromLayout removes stripped chrome subtrees so repair cannot append them at the bottom", () => {
    const composed = composePageWithHomepageChrome(
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        root: "ROOT",
        nodes: {
          ROOT: {
            type: { resolvedName: "Section" },
            isCanvas: true,
            props: {},
            displayName: "Section",
            parent: null,
            hidden: false,
            nodes: ["child-body"],
            linkedNodes: {},
            custom: {},
          },
          "child-body": bodySection("child-body"),
        },
      },
      homepageLayout(),
      {},
      "how-it-works",
    );

    const stripped = stripChromeFromLayout(composed);
    const repaired = migrate(stripped);

    expect(repaired.nodes.ROOT.nodes).toEqual(["child-body"]);
    expect(repaired.nodes.ROOT.nodes).not.toContain("top");
    expect(repaired.nodes.ROOT.nodes).not.toContain("nav");
    expect(repaired.nodes.ROOT.nodes).not.toContain("foot");
    expect(Object.keys(repaired.nodes).some((id) => id.includes("inh_"))).toBe(false);
    expect(Object.values(repaired.nodes).some((n) => n.type?.resolvedName === "Navbar")).toBe(
      false,
    );
  });

  it("composePageWithHomepageChrome does not leave page chrome orphans that repair moves to the bottom", () => {
    const childWithChrome: SerializedLayout = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: "ROOT",
      nodes: {
        ROOT: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          displayName: "Section",
          parent: null,
          hidden: false,
          nodes: ["top", "nav", "child-body", "foot"],
          linkedNodes: {},
          custom: {},
        },
        top: section("top", "#147eff"),
        nav: navbar("nav"),
        "child-body": bodySection("child-body"),
        foot: section("foot", "#002244"),
      },
    };

    const composed = composePageWithHomepageChrome(
      childWithChrome,
      homepageLayout(),
      {},
      "how-it-works",
    );
    const repaired = migrate(composed);
    const slots = identifyChromeSlots(repaired);
    const rootChildren = repaired.nodes.ROOT.nodes ?? [];

    expect(slots.bodyIds).toEqual(["child-body"]);
    expect(slots.navbarId).toBeDefined();
    expect(slots.topbarId).toBeDefined();
    expect(rootChildren.indexOf("child-body")).toBeGreaterThan(-1);
    expect(rootChildren.indexOf(slots.navbarId!)).toBeLessThan(
      rootChildren.indexOf("child-body"),
    );
    expect(rootChildren.indexOf(slots.topbarId!)).toBeLessThan(
      rootChildren.indexOf("child-body"),
    );
    expect(rootChildren.indexOf(slots.footerId!)).toBeGreaterThan(
      rootChildren.indexOf("child-body"),
    );
    expect(rootChildren.filter((id) => id === "top").length).toBe(0);
    expect(rootChildren.filter((id) => id === "nav").length).toBe(0);
  });

  it("normalizeChromeOrder moves misordered homepage chrome before body sections", () => {
    const misordered: SerializedLayout = {
      ...homepageLayout(),
      nodes: {
        ...homepageLayout().nodes,
        ROOT: {
          ...homepageLayout().nodes.ROOT,
          nodes: ["body", "top", "foot", "nav"],
        },
      },
    };

    const normalized = normalizeChromeOrder(misordered);
    expect(normalized.nodes.ROOT.nodes).toEqual(["top", "nav", "body", "foot"]);
  });

  it("normalizeChromeOrder is idempotent for canonical homepage order", () => {
    const home = homepageLayout();
    expect(normalizeChromeOrder(home)).toBe(home);
  });

  it("composePageWithHomepageChrome normalizes misordered homepage layouts on read", () => {
    const misordered: SerializedLayout = {
      ...homepageLayout(),
      nodes: {
        ...homepageLayout().nodes,
        ROOT: {
          ...homepageLayout().nodes.ROOT,
          nodes: ["body", "top", "foot", "nav"],
        },
      },
    };

    const composed = composePageWithHomepageChrome(misordered, null, null, "obhomepage");
    expect(composed.nodes.ROOT.nodes).toEqual(["top", "nav", "body", "foot"]);
  });
});
