import { describe, it, expect } from "bun:test";
import { CURRENT_SCHEMA_VERSION, type SerializedLayout } from "../layout";
import { migrate } from "../migrate";
import { deserializeLayout } from "../import-export";
import {
  composePageWithHomepageChrome,
  identifyChromeSlots,
  isHomepageSlug,
  stripChromeFromLayout,
} from "../chrome-layout";
import obhomepagePresetFixture from "./fixtures/obhomepage-preset.fixture.json";

const PRESET_TOPBAR_ID = "ob_0";
const PRESET_NAVBAR_ID = "ob_4";
const PRESET_FOOTER_ID = "ob_295";
const PRESET_TOPBAR_INDEX = 0;
const PRESET_NAVBAR_INDEX = 1;
const PRESET_FOOTER_INDEX = 18;
const PREVIEW_CYCLE_COUNT = 3;
const IMPORTED_HERO_ID = "hero";
const OBHOMEPAGE_SLUG = "obhomepage";
const NAVBAR_RESOLVED_NAME = "Navbar";

/** Mirrors API `validateLayout` → `deserializeLayout` → migrate → repair. */
const persistLayout = (layout: SerializedLayout): SerializedLayout =>
  deserializeLayout(JSON.stringify(layout));

/** Mirrors BuilderShell `beforePersist` (see apps/admin/.../BuilderShell.tsx). */
const beforePersist = (
  layout: SerializedLayout,
  slug: string,
  layoutOptions?: { inheritHomepageChrome?: boolean },
): SerializedLayout => {
  if (isHomepageSlug(slug)) return layout;
  if (layoutOptions?.inheritHomepageChrome === false) return layout;
  return stripChromeFromLayout(layout);
};

/** Full Preview-click persist path: editor composed layout → save payload → API repair. */
const simulatePreviewSave = (
  editorLayout: SerializedLayout,
  slug: string,
  layoutOptions?: { inheritHomepageChrome?: boolean },
): SerializedLayout => persistLayout(beforePersist(editorLayout, slug, layoutOptions));

/** Builder reload: stored draft → compose for display → repair on craft conversion. */
const simulateBuilderReload = (
  storedDraft: SerializedLayout,
  slug: string,
  homepageLayout: SerializedLayout | null,
  layoutOptions?: { inheritHomepageChrome?: boolean },
): SerializedLayout =>
  migrate(
    composePageWithHomepageChrome(
      migrate(storedDraft),
      homepageLayout,
      layoutOptions ?? null,
      slug,
    ),
  );

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
    type: { resolvedName: NAVBAR_RESOLVED_NAME },
    isCanvas: true,
    props: { logoText: "Office Beacon" },
    displayName: NAVBAR_RESOLVED_NAME,
    parent,
    hidden: false,
    nodes: [],
    linkedNodes: {},
    custom: {},
  };
}

function reusableBlock(id: string, reusableBlockId: string, parent = "ROOT"): SerializedLayout["nodes"][string] {
  return {
    type: { resolvedName: "ReusableBlock" },
    isCanvas: false,
    props: { reusableBlockId },
    displayName: "Reusable Block",
    parent,
    hidden: false,
    nodes: [],
    linkedNodes: {},
    custom: {},
  };
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

function bodySection(id: string, parent = "ROOT"): SerializedLayout["nodes"][string] {
  return section(id, "#ffffff", parent);
}

function childBodyOnly(slug: string): SerializedLayout {
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
        nodes: [`${slug}-body`],
        linkedNodes: {},
        custom: {},
      },
      [`${slug}-body`]: bodySection(`${slug}-body`),
    },
  };
}

function rootChildOrder(layout: SerializedLayout): string[] {
  return [...(layout.nodes[layout.root]?.nodes ?? [])];
}

function assertNoInhNodes(layout: SerializedLayout): void {
  expect(Object.keys(layout.nodes).some((id) => id.includes("inh_"))).toBe(false);
}

function assertChromeBeforeBody(layout: SerializedLayout): void {
  const slots = identifyChromeSlots(layout);
  const rootChildren = rootChildOrder(layout);
  const bodyIndex = rootChildren.indexOf(slots.bodyIds[0] ?? "");
  if (slots.topbarId) {
    expect(rootChildren.indexOf(slots.topbarId)).toBeLessThan(bodyIndex);
  }
  if (slots.navbarId) {
    expect(rootChildren.indexOf(slots.navbarId)).toBeLessThan(bodyIndex);
  }
  if (slots.footerId) {
    expect(rootChildren.indexOf(slots.footerId)).toBeGreaterThan(bodyIndex);
  }
}

function assertNoOrphanedRootChrome(layout: SerializedLayout): void {
  const rootChildren = new Set(rootChildOrder(layout));
  for (const [id, node] of Object.entries(layout.nodes)) {
    if (id === layout.root) continue;
    if (node.parent !== layout.root) continue;
    expect(rootChildren.has(id)).toBe(true);
  }
}

function assertLayoutsEquivalent(a: SerializedLayout, b: SerializedLayout): void {
  expect(rootChildOrder(a)).toEqual(rootChildOrder(b));
  expect(identifyChromeSlots(a)).toEqual(identifyChromeSlots(b));
  assertNoOrphanedRootChrome(a);
  assertNoOrphanedRootChrome(b);
}

describe("Preview layout persist regression", () => {
  const home = homepageLayout();

  describe("Test A — ob-homepage (homepage slug)", () => {
    it("preview save does not reorder homepage chrome", () => {
      const editorLayout = migrate(home);
      const stored = simulatePreviewSave(editorLayout, "ob-homepage");
      const reloaded = simulateBuilderReload(stored, "ob-homepage", home);

      assertChromeBeforeBody(reloaded);
      assertNoOrphanedRootChrome(stored);
      assertLayoutsEquivalent(editorLayout, reloaded);
    });
  });

  describe("Test A2 — obhomepage slug (no hyphen)", () => {
    const canonicalPreset = (): SerializedLayout =>
      migrate(obhomepagePresetFixture as SerializedLayout);

    it("is recognized as a homepage slug", () => {
      expect(isHomepageSlug(OBHOMEPAGE_SLUG)).toBe(true);
    });

    it("preview save preserves topbar [0], navbar [1], footer [18] across preview cycles", () => {
      let editorLayout = canonicalPreset();
      const baselineOrder = rootChildOrder(editorLayout);
      expect(baselineOrder[PRESET_TOPBAR_INDEX]).toBe(PRESET_TOPBAR_ID);
      expect(baselineOrder[PRESET_NAVBAR_INDEX]).toBe(PRESET_NAVBAR_ID);
      expect(baselineOrder[PRESET_FOOTER_INDEX]).toBe(PRESET_FOOTER_ID);
      expect(editorLayout.nodes[baselineOrder[PRESET_NAVBAR_INDEX]]?.type?.resolvedName).toBe(
        NAVBAR_RESOLVED_NAME,
      );

      for (let cycle = 0; cycle < PREVIEW_CYCLE_COUNT; cycle += 1) {
        const stored = simulatePreviewSave(editorLayout, OBHOMEPAGE_SLUG);
        editorLayout = simulateBuilderReload(stored, OBHOMEPAGE_SLUG, editorLayout);

        assertChromeBeforeBody(editorLayout);
        assertNoOrphanedRootChrome(stored);
        expect(rootChildOrder(editorLayout)[PRESET_TOPBAR_INDEX]).toBe(PRESET_TOPBAR_ID);
        expect(rootChildOrder(editorLayout)[PRESET_NAVBAR_INDEX]).toBe(PRESET_NAVBAR_ID);
        expect(rootChildOrder(editorLayout)[PRESET_FOOTER_INDEX]).toBe(PRESET_FOOTER_ID);
      }

      expect(rootChildOrder(editorLayout)).toEqual(baselineOrder);
    });

    it("inheritHomepageChrome: false still skips strip for obhomepage slug", () => {
      const editorLayout = canonicalPreset();
      const stored = simulatePreviewSave(editorLayout, OBHOMEPAGE_SLUG, {
        inheritHomepageChrome: false,
      });
      assertLayoutsEquivalent(editorLayout, stored);
    });
  });

  describe("Test B — child page with inheritHomepageChrome: true", () => {
    const slug = "how-it-works";
    const opts = { inheritHomepageChrome: true as const };

    it("Preview → Back → Reload preserves topbar/navbar/footer above body", () => {
      const storedDraft = childBodyOnly(slug);
      const editorLayout = simulateBuilderReload(storedDraft, slug, home, opts);
      const afterPreviewSave = simulatePreviewSave(editorLayout, slug, opts);
      const afterReload = simulateBuilderReload(afterPreviewSave, slug, home, opts);

      assertChromeBeforeBody(afterReload);
      assertNoOrphanedRootChrome(afterPreviewSave);
      assertNoInhNodes(afterPreviewSave);
      expect(identifyChromeSlots(afterPreviewSave).bodyIds).toEqual([`${slug}-body`]);
      assertLayoutsEquivalent(editorLayout, afterReload);
    });

    it("Preview → Save → Reload preserves layout and body-only persisted draft", () => {
      const editorLayout = simulateBuilderReload(childBodyOnly(slug), slug, home, opts);
      const persisted = simulatePreviewSave(editorLayout, slug, opts);
      const reloaded = simulateBuilderReload(persisted, slug, home, opts);

      assertNoInhNodes(persisted);
      expect(persisted.nodes.ROOT.nodes).toEqual([`${slug}-body`]);
      assertLayoutsEquivalent(editorLayout, reloaded);
    });
  });

  describe("Test C — imported page with embedded chrome + reusable blocks", () => {
    const slug = "imported-service-page";

    it("does not move reusable navbar/topbar or duplicate inherited chrome after preview", () => {
      const imported: SerializedLayout = {
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
            nodes: ["rb-topbar", "rb-navbar", "hero", "content"],
            linkedNodes: {},
            custom: {},
          },
          "rb-topbar": reusableBlock("rb-topbar", "site-topbar-ref"),
          "rb-navbar": reusableBlock("rb-navbar", "site-navbar-ref"),
          hero: bodySection("hero"),
          content: bodySection("content"),
        },
      };

      const editorLayout = simulateBuilderReload(imported, slug, home, {
        inheritHomepageChrome: true,
      });
      const beforeReusableIds = Object.values(editorLayout.nodes)
        .filter((n) => n.type?.resolvedName === "ReusableBlock")
        .map((n) => n.props?.reusableBlockId as string);

      const opts = { inheritHomepageChrome: true as const };
      const stored = simulatePreviewSave(editorLayout, slug, opts);
      const reloaded = simulateBuilderReload(stored, slug, home, opts);

      assertNoOrphanedRootChrome(stored);
      assertNoInhNodes(stored);
      assertChromeBeforeBody(reloaded);

      const afterReusableIds = Object.values(reloaded.nodes)
        .filter((n) => n.type?.resolvedName === "ReusableBlock")
        .map((n) => n.props?.reusableBlockId as string);
      expect(afterReusableIds.sort()).toEqual(beforeReusableIds.sort());

      for (const reusableId of ["rb-topbar", "rb-navbar"]) {
        expect(rootChildOrder(reloaded).indexOf(reusableId)).toBeGreaterThan(-1);
      }

      const navCount = Object.values(reloaded.nodes).filter(
        (n) => n.type?.resolvedName === NAVBAR_RESOLVED_NAME,
      ).length;
      expect(navCount).toBe(1);

      const reloadedOrder = rootChildOrder(reloaded);
      const inheritedNavbarIndex = reloadedOrder.findIndex(
        (id) => reloaded.nodes[id]?.type?.resolvedName === NAVBAR_RESOLVED_NAME,
      );
      const heroIndex = reloadedOrder.indexOf(IMPORTED_HERO_ID);
      expect(inheritedNavbarIndex).toBeGreaterThan(-1);
      expect(heroIndex).toBeGreaterThan(-1);
      expect(inheritedNavbarIndex).toBeLessThan(heroIndex);
      expect(reloadedOrder.indexOf("rb-navbar")).toBeGreaterThan(inheritedNavbarIndex);
    });
  });

  describe("Test D — inheritHomepageChrome: false", () => {
    const slug = "standalone-landing";

    it("preview save does not mutate a self-contained layout", () => {
      const standalone: SerializedLayout = {
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
            nodes: ["top", "nav", "hero", "foot"],
            linkedNodes: {},
            custom: {},
          },
          top: section("top", "#147eff"),
          nav: navbar("nav"),
          hero: bodySection("hero"),
          foot: section("foot", "#002244"),
        },
      };

      const opts = { inheritHomepageChrome: false as const };
      const editorLayout = simulateBuilderReload(standalone, slug, home, opts);
      const stored = simulatePreviewSave(editorLayout, slug, opts);
      const reloaded = simulateBuilderReload(stored, slug, home, opts);

      assertChromeBeforeBody(reloaded);
      assertNoOrphanedRootChrome(stored);
      assertLayoutsEquivalent(editorLayout, reloaded);
    });
  });

  describe("Test E — reusable blocks only (no direct Navbar nodes in body storage)", () => {
    const slug = "reusable-chrome-page";

    it("keeps reusable block order through preview cycles", () => {
      const draft: SerializedLayout = {
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
            nodes: ["rb-nav", "section-a", "rb-footer"],
            linkedNodes: {},
            custom: {},
          },
          "rb-nav": reusableBlock("rb-nav", "global-nav"),
          "section-a": bodySection("section-a"),
          "rb-footer": reusableBlock("rb-footer", "global-footer"),
        },
      };

      let editorLayout = simulateBuilderReload(draft, slug, home, { inheritHomepageChrome: true });
      const initialOrder = rootChildOrder(editorLayout);

      const opts = { inheritHomepageChrome: true as const };
      for (let cycle = 0; cycle < PREVIEW_CYCLE_COUNT; cycle += 1) {
        const stored = simulatePreviewSave(editorLayout, slug, opts);
        editorLayout = simulateBuilderReload(stored, slug, home, opts);
        assertNoOrphanedRootChrome(stored);
        assertNoInhNodes(stored);
      }

      expect(rootChildOrder(editorLayout)).toEqual(initialOrder);
    });
  });

  describe("Repeated Preview cycles (3×)", () => {
    for (const slug of ["pricing", "about-us"]) {
      it(`stable across ${PREVIEW_CYCLE_COUNT} preview cycles for ${slug}`, () => {
        let editorLayout = simulateBuilderReload(childBodyOnly(slug), slug, home, {
          inheritHomepageChrome: true,
        });
        const baseline = rootChildOrder(editorLayout);

        const opts = { inheritHomepageChrome: true as const };
        for (let i = 0; i < PREVIEW_CYCLE_COUNT; i += 1) {
          const stored = simulatePreviewSave(editorLayout, slug, opts);
          editorLayout = simulateBuilderReload(stored, slug, home, opts);
          assertNoOrphanedRootChrome(stored);
          assertNoInhNodes(stored);
          assertChromeBeforeBody(editorLayout);
        }

        expect(rootChildOrder(editorLayout)).toEqual(baseline);
      });
    }
  });

  describe("Preview + Save layout comparison", () => {
    it("persisted draft differs from editor only by stripped inherited chrome, not reordered orphans", () => {
      const slug = "compare-layout-page";
      const editorLayout = simulateBuilderReload(childBodyOnly(slug), slug, home, {
        inheritHomepageChrome: true,
      });
      const before = JSON.stringify({
        rootOrder: rootChildOrder(editorLayout),
        slots: identifyChromeSlots(editorLayout),
        reusableIds: Object.entries(editorLayout.nodes)
          .filter(([, n]) => n.type?.resolvedName === "ReusableBlock")
          .map(([id, n]) => [id, n.props?.reusableBlockId]),
      });

      const opts = { inheritHomepageChrome: true as const };
      const stored = simulatePreviewSave(editorLayout, slug, opts);
      assertNoInhNodes(stored);
      const after = JSON.stringify({
        rootOrder: rootChildOrder(stored),
        slots: identifyChromeSlots(stored),
        orphanRootNodes: Object.entries(stored.nodes)
          .filter(([id, n]) => id !== stored.root && n.parent === stored.root)
          .map(([id]) => id)
          .filter((id) => !rootChildOrder(stored).includes(id)),
      });

      const parsedAfter = JSON.parse(after) as {
        rootOrder: string[];
        orphanRootNodes: string[];
      };
      expect(parsedAfter.orphanRootNodes).toEqual([]);
      expect(parsedAfter.rootOrder).toEqual([`${slug}-body`]);

      const reloaded = simulateBuilderReload(stored, slug, home, { inheritHomepageChrome: true });
      expect(rootChildOrder(reloaded)).toEqual(JSON.parse(before).rootOrder);
      expect(identifyChromeSlots(reloaded)).toEqual(JSON.parse(before).slots);
    });
  });

  describe("Published render path", () => {
    it("preview-stored body composes identically for public render", () => {
      const slug = "published-check";
      const editorLayout = simulateBuilderReload(childBodyOnly(slug), slug, home, {
        inheritHomepageChrome: true,
      });
      const opts = { inheritHomepageChrome: true as const };
      const stored = simulatePreviewSave(editorLayout, slug, opts);
      const previewRender = simulateBuilderReload(stored, slug, home, { inheritHomepageChrome: true });
      const publishRender = composePageWithHomepageChrome(
        migrate(stored),
        home,
        { inheritHomepageChrome: true },
        slug,
      );

      assertLayoutsEquivalent(previewRender, migrate(publishRender));
    });

    it("misordered homepage chrome normalizes on published compose (legacy orphan repair)", () => {
      const misordered: SerializedLayout = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        root: "ROOT",
        nodes: {
          ...homepageLayout().nodes,
          ROOT: {
            ...homepageLayout().nodes.ROOT,
            nodes: ["body", "top", "foot", "nav"],
          },
        },
      };

      const publishRender = composePageWithHomepageChrome(
        migrate(misordered),
        null,
        null,
        OBHOMEPAGE_SLUG,
      );

      assertChromeBeforeBody(publishRender);
      const order = rootChildOrder(publishRender);
      expect(order.indexOf("top")).toBe(PRESET_TOPBAR_INDEX);
      expect(order.indexOf("nav")).toBe(PRESET_NAVBAR_INDEX);
      expect(order.indexOf("foot")).toBeGreaterThan(order.indexOf("body"));
    });

    for (const slug of ["home", "ob-homepage", OBHOMEPAGE_SLUG] as const) {
      it(`published compose normalizes misordered chrome for ${slug}`, () => {
        const misordered: SerializedLayout = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          root: "ROOT",
          nodes: {
            ...homepageLayout().nodes,
            ROOT: {
              ...homepageLayout().nodes.ROOT,
              nodes: ["body", "top", "nav", "foot"],
            },
          },
        };

        const composed = composePageWithHomepageChrome(migrate(misordered), null, null, slug);
        assertChromeBeforeBody(composed);
        expect(rootChildOrder(composed)).toEqual(["top", "nav", "body", "foot"]);
      });
    }
  });

  describe("Stripped chrome persistence invariant", () => {
    it("leaves no root-parented orphan chrome and persists body-only layout after strip", () => {
      const slug = "bug-sentinel";
      const editorLayout = simulateBuilderReload(childBodyOnly(slug), slug, home, {
        inheritHomepageChrome: true,
      });

      const strippedOnly = stripChromeFromLayout(editorLayout);
      const orphanedParentRoot = Object.entries(strippedOnly.nodes).filter(
        ([id, n]) => id !== strippedOnly.root && n.parent === strippedOnly.root,
      );
      const listed = new Set(rootChildOrder(strippedOnly));
      const orphanIds = orphanedParentRoot.map(([id]) => id).filter((id) => !listed.has(id));

      expect(orphanIds.length).toBe(0);
      expect(persistLayout(strippedOnly).nodes.ROOT.nodes).toEqual([`${slug}-body`]);
    });
  });
});
