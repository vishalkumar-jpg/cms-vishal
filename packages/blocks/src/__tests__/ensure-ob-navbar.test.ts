import { describe, it, expect } from "bun:test";
import { identifyChromeSlots, migrate, type SerializedLayout } from "@ob-cms/block-schema";
import { ensureObHomepageNavbar } from "../hydrate-navbar";

const obHomepageWithoutNavbar = (): SerializedLayout =>
  migrate({
    schemaVersion: "2.0",
    root: "ROOT",
    nodes: {
      ROOT: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        displayName: "Section",
        parent: null,
        nodes: ["topbar", "hero"],
        linkedNodes: {},
        custom: {},
        hidden: false,
      },
      topbar: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {
          styles: { colors: { backgroundColor: "#147eff" } },
        },
        displayName: "Section",
        parent: "ROOT",
        nodes: [],
        linkedNodes: {},
        custom: {},
        hidden: false,
      },
      hero: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        displayName: "Section",
        parent: "ROOT",
        nodes: [],
        linkedNodes: {},
        custom: {},
        hidden: false,
      },
    },
  });

describe("ensureObHomepageNavbar", () => {
  it("inserts a legacy OB navbar after the blue topbar when missing", () => {
    const { layout, changed } = ensureObHomepageNavbar(obHomepageWithoutNavbar());
    expect(changed).toBe(true);
    const slots = identifyChromeSlots(layout);
    expect(slots.navbarId).toBeTruthy();
    expect(slots.topbarId).toBe("topbar");
    const rootChildren = layout.nodes[layout.root]?.nodes ?? [];
    expect(rootChildren.indexOf(slots.navbarId!)).toBe(rootChildren.indexOf("topbar") + 1);
    const navbar = layout.nodes[slots.navbarId!];
    expect(navbar?.type?.resolvedName).toBe("Navbar");
    const props = navbar?.props as Record<string, unknown>;
    expect(props.mode).toBe("legacy");
    expect(Array.isArray(props.navItems)).toBe(true);
    expect((props.navItems as unknown[]).length).toBeGreaterThan(0);
  });

  it("leaves layouts that already have a navbar unchanged", () => {
    const base = obHomepageWithoutNavbar();
    const navId = "existing_nav";
    const nodes = {
      ...base.nodes,
      [navId]: {
        type: { resolvedName: "Navbar" },
        isCanvas: false,
        props: { logoText: "Office Beacon", mode: "legacy", navItems: [{ label: "Home", url: "/" }] },
        displayName: "Navbar",
        parent: base.root,
        nodes: [],
        linkedNodes: {},
        custom: {},
        hidden: false,
      },
    };
    const root = nodes[base.root];
    nodes[base.root] = {
      ...root,
      nodes: ["topbar", navId, "hero"],
    };
    const withNav = migrate({ ...base, nodes });
    const { changed } = ensureObHomepageNavbar(withNav);
    expect(changed).toBe(false);
  });
});
