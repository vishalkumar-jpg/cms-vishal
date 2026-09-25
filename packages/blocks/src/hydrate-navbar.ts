import { normalizeNavbarForLiveSite, identifyChromeSlots, migrate, type SerializedLayout, type BlockNode } from "@ob-cms/block-schema";
import { OB_NAV_ITEMS } from "./ob-nav-data";

const freshId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `ob_nav_${crypto.randomUUID().slice(0, 8)}`
    : `ob_nav_${Date.now().toString(36)}`;

const OB_TOPBAR_BACKGROUNDS = new Set(["#147eff", "rgb(20, 126, 255)"]);

const sectionBackground = (node: BlockNode | undefined): string => {
  const styles = node?.props?.styles as Record<string, unknown> | undefined;
  const colors = styles?.colors as Record<string, unknown> | undefined;
  return String(colors?.backgroundColor ?? "")
    .trim()
    .toLowerCase();
};

const isObTopbarNode = (node: BlockNode | undefined): boolean => {
  if (!node) return false;
  if (node.type?.resolvedName === "Topbar") return true;
  return node.type?.resolvedName === "Section" && OB_TOPBAR_BACKGROUNDS.has(sectionBackground(node));
};

const layoutLooksLikeObHomepage = (layout: SerializedLayout): boolean => {
  for (const node of Object.values(layout.nodes)) {
    const props = (node?.props ?? {}) as Record<string, unknown>;
    const logoText = String(props.logoText ?? "");
    if (/office\s*beacon/i.test(logoText)) return true;
    const logoUrl = String(props.logoUrl ?? props.logoImage ?? "");
    if (/officebeacon/i.test(logoUrl) || logoUrl.includes("/ob-homepage")) return true;
  }
  const slots = identifyChromeSlots(layout);
  return Boolean(slots.topbarId && isObTopbarNode(layout.nodes[slots.topbarId]));
};

/** Default navbar styles from the OB homepage seed (white bar + subtle shadow). */
const obNavbarHomepageStyles = (): Record<string, unknown> => ({
  colors: { backgroundColor: "#ffffff" },
  spacing: { paddingTop: 0, paddingRight: 24, paddingBottom: 0, paddingLeft: 24 },
  effects: {},
  shadows: { boxShadow: "0px 1px 0px 0px rgba(108,124,147,0.1)" },
});

/**
 * Re-insert the Office Beacon navbar when it was removed from the homepage layout.
 * Only runs on OB-style homepages (blue topbar / Office Beacon branding) that are
 * missing a Navbar slot.
 */
export const ensureObHomepageNavbar = (
  layout: SerializedLayout,
): { layout: SerializedLayout; changed: boolean } => {
  const migrated = migrate(layout);
  const slots = identifyChromeSlots(migrated);
  if (slots.navbarId) return { layout: migrated, changed: false };
  if (!layoutLooksLikeObHomepage(migrated)) return { layout: migrated, changed: false };

  const root = migrated.nodes[migrated.root];
  if (!root) return { layout: migrated, changed: false };

  const navbarId = freshId();
  const navbarNode: BlockNode = {
    type: { resolvedName: "Navbar" },
    isCanvas: false,
    props: {
      ...obNavbarLiveProps(),
      linkStyles: { color: "#7889a0", fontSize: 16 },
      styles: obNavbarHomepageStyles(),
    },
    displayName: "Navbar",
    parent: migrated.root,
    nodes: [],
    linkedNodes: {},
    custom: {},
    hidden: false,
  };

  const children = [...(root.nodes ?? [])];
  const insertAfter = slots.topbarId ? children.indexOf(slots.topbarId) + 1 : 0;
  children.splice(Math.max(0, insertAfter), 0, navbarId);

  const nodes = {
    ...migrated.nodes,
    [navbarId]: navbarNode,
    [migrated.root]: { ...root, nodes: children },
  };

  return {
    layout: migrate({ ...migrated, nodes }),
    changed: true,
  };
};

const OB_NAV_LINK_STYLES = {
  color: "#7889a0",
  fontSize: 16,
};

const OB_NAV_CTA_STYLES = {
  background: "linear-gradient(90deg, #147eff, #4d9dff)",
  color: "#ffffff",
  paddingX: 16,
  paddingY: 12,
  borderRadius: 6,
};

/** Full Office Beacon navbar props — matches www.officebeacon.com desktop nav. */
export const obNavbarLiveProps = (): Record<string, unknown> => ({
  mode: "legacy",
  logoImage:
    "https://www.officebeacon.com/hs-fs/hubfs/office-beacon/logos/OB%20Logo%20Colour.png?width=175&height=38&name=OB%20Logo%20Colour.png",
  logoUrl: "/ob-homepage",
  logoText: "Office Beacon",
  logoImageHeight: 38,
  navItems: structuredClone(OB_NAV_ITEMS),
  linkStyles: { ...OB_NAV_LINK_STYLES },
  ctaText: "Get Started",
  ctaUrl: "https://www.officebeacon.com/lp/build-your-remote-team",
  showCta: true,
  ctaStyles: { ...OB_NAV_CTA_STYLES },
  sticky: true,
});

const isObNavbarNode = (props: Record<string, unknown>): boolean => {
  const logoText = String(props.logoText ?? "");
  const logoUrl = String(props.logoUrl ?? props.logoImage ?? "");
  return /office\s*beacon/i.test(logoText) || /officebeacon/i.test(logoUrl);
};

/**
 * Normalize Navbar craft nodes on load (logo, mode, nav order, CTA).
 * Office Beacon navbars are synced to the live site menu on every load.
 */
export const hydrateNavbarNodes = (
  nodes: Record<string, unknown>,
): { nodes: Record<string, unknown>; changed: boolean } => {
  let changed = false;
  const next: Record<string, unknown> = { ...nodes };

  for (const [id, raw] of Object.entries(nodes)) {
    const node = raw as {
      type?: { resolvedName?: string };
      props?: Record<string, unknown>;
      nodes?: string[];
    };
    if (node?.type?.resolvedName !== "Navbar") continue;

    const before = JSON.stringify(node.props ?? {});
    const base = normalizeNavbarForLiveSite({ ...(node.props ?? {}) });
    const live = obNavbarLiveProps();
    const isOb = isObNavbarNode(base);

    const props = isOb
      ? {
          ...live,
          ...base,
          mode: "legacy",
          navItems:
            Array.isArray(base.navItems) && base.navItems.length > 0
              ? base.navItems
              : live.navItems,
          logoUrl:
            typeof base.logoUrl === "string" && base.logoUrl.startsWith("/")
              ? base.logoUrl
              : live.logoUrl,
          styles: base.styles ?? (node.props as Record<string, unknown>)?.styles,
        }
      : {
          ...base,
          mode:
            Array.isArray(base.navItems) && base.navItems.length > 0
              ? "legacy"
              : (base.mode as string) ?? "legacy",
          navItems:
            Array.isArray(base.navItems) && base.navItems.length > 0
              ? base.navItems
              : structuredClone(OB_NAV_ITEMS),
        };

    const after = JSON.stringify(props);
    if (before !== after) {
      next[id] = { ...node, props };
      changed = true;
    }
  }

  return { nodes: changed ? next : nodes, changed };
};
