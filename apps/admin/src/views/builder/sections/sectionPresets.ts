import type { SerializedLayout } from "@ob-cms/block-schema";
import { OB_NAV_ITEMS, OB_STAFFING_MEGA_COLUMNS } from "@ob-cms/blocks";
import { regenerateLayoutIds as regenerateCraftLayoutIds } from "../craft/regenerateLayoutIds";

export { regenerateLayoutIds } from "../craft/regenerateLayoutIds";

const obNavByLabel = (label: string) => OB_NAV_ITEMS.find((item) => item.label === label);

/**
 * SECTION / PATTERN LIBRARY — pre-built, theme-aware sections a marketer drops
 * onto a page in one click. Each preset is a self-contained `SerializedLayout`
 * subtree whose ROOT is a `Section` node, composed from REAL registered block
 * types (@ob-cms/blocks) with valid props so it renders identically in the
 * builder canvas (Craft.js) and the Next.js renderer.
 *
 * THEMING: colors use design-system tokens (`hsl(var(--primary))`,
 * `hsl(var(--muted))`, …) instead of hardcoded brand hex, so a dropped section
 * automatically re-themes per tenant (a site with a different brand color gets
 * re-skinned with zero edits). The same token convention the Style panel writes
 * (see property/styleTokens.ts).
 *
 * INSERT: `sectionLayout(preset)` returns a `{ root: "ROOT", nodes }` layout the
 * insert path (SectionLibraryPanel) feeds through `layoutToCraft` +
 * `buildTreeFromSerializedMap`. Node ids are PRESET-LOCAL and regenerated to be
 * globally-unique on every insert, so dropping the same preset twice never
 * collides. Inserted blocks are normal, fully-editable Craft nodes (not locked).
 */

/* ------------------------------------------------------------------ */
/* Theme tokens (no hardcoded brand hex — re-themes per tenant)       */
/* ------------------------------------------------------------------ */
const T = {
  primary: "hsl(var(--primary))",
  primaryFg: "hsl(var(--primary-foreground))",
  fg: "hsl(var(--foreground))",
  bg: "hsl(var(--background))",
  muted: "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  card: "hsl(var(--card))",
  accent: "hsl(var(--accent))",
  border: "hsl(var(--border))",
} as const;

/* ------------------------------------------------------------------ */
/* Node-builder helper — keeps presets readable                       */
/* ------------------------------------------------------------------ */

/** A single serialized Craft node (subset we author by hand). */
interface PNode {
  type: { resolvedName: string };
  isCanvas?: boolean;
  props?: Record<string, unknown>;
  nodes?: PNode[];
  displayName?: string;
}

const CANVAS = new Set([
  "Section",
  "Container",
  "Row",
  "Column",
  "Grid",
  "Div",
  "Footer",
  "Footer Columns",
  "Navbar",
  "NavMenu",
]);

/** Build a node. `n(type, props, children?)`. isCanvas is inferred. */
const n = (
  type: string,
  props: Record<string, unknown> = {},
  nodes: PNode[] = [],
): PNode => ({
  type: { resolvedName: type },
  isCanvas: CANVAS.has(type),
  props,
  nodes,
  displayName: type,
});

/** Convenience helpers for the common leaf blocks. */
const section = (props: Record<string, unknown>, nodes: PNode[]): PNode =>
  n("Section", props, nodes);
const container = (props: Record<string, unknown>, nodes: PNode[]): PNode =>
  n("Container", props, nodes);
const heading = (text: string, props: Record<string, unknown> = {}): PNode =>
  n("Heading", { text, level: 2, ...props });
const paragraph = (text: string, props: Record<string, unknown> = {}): PNode =>
  n("Paragraph", { text, ...props });
const button = (label: string, props: Record<string, unknown> = {}): PNode =>
  n("Button", { label, url: "#", ...props });
const sectionHeading = (props: Record<string, unknown>): PNode =>
  n("Section Heading", { align: "center", ...props });
const link = (text: string, props: Record<string, unknown> = {}): PNode =>
  n("Link", { text, url: "#", ...props });
const image = (props: Record<string, unknown> = {}): PNode =>
  n("Image", { imageUrl: PLACEHOLDER_IMG, altText: "Image", ...props });
const icon = (name: string, props: Record<string, unknown> = {}): PNode =>
  n("Icon", { name, size: 24, color: T.primary, ...props });
const row = (props: Record<string, unknown>, nodes: PNode[]): PNode =>
  n("Row", props, nodes);
const column = (props: Record<string, unknown>, nodes: PNode[]): PNode =>
  n("Column", props, nodes);
const grid = (columns: number, nodes: PNode[], gap = 24): PNode =>
  n("Grid", { columns, styles: { layout: { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap } } }, nodes);

/** A Section's shared styling: vertical padding + token bg + centered max-width. */
const sectionStyles = (opts: {
  bg?: string;
  fg?: string;
  py?: number;
  align?: string;
} = {}): Record<string, unknown> => ({
  styles: {
    spacing: { paddingTop: opts.py ?? 80, paddingBottom: opts.py ?? 80, paddingLeft: 24, paddingRight: 24 },
    colors: { backgroundColor: opts.bg, textColor: opts.fg },
    typography: opts.align ? { textAlign: opts.align } : undefined,
  },
});

const containerStyles = (max = 1100): Record<string, unknown> => ({
  maxWidth: max,
  styles: { sizing: { maxWidth: max }, spacing: { marginLeft: "auto", marginRight: "auto" } },
});

/* ------------------------------------------------------------------ */
/* Preset model                                                       */
/* ------------------------------------------------------------------ */

export type SectionCategory =
  | "Full Page"
  | "Hero"
  | "Navigation"
  | "Features"
  | "CTA"
  | "Pricing"
  | "FAQ"
  | "Testimonials"
  | "Stats"
  | "Team"
  | "Logos"
  | "Contact"
  | "Gallery"
  | "Timeline"
  | "Blog"
  | "Cards"
  | "Footer"
  | "Content"
  | "Layout";

/**
 * Top-level grouping shown in the Section Library panel, mirroring a modern
 * builder toolbox: full pre-built sections, decomposed starters, and bare
 * column layouts.
 */
export type SectionGroup =
  | "Built-in Components"
  | "Section Starters"
  | "Quick Layouts";

export interface SectionPreset {
  id: string;
  name: string;
  category: SectionCategory;
  /** Toolbox group (defaults to "Built-in Components" when omitted). */
  group?: SectionGroup;
  /** Short description shown under the card name. */
  description: string;
  /** The preset's root Section node (authored with the helper above). */
  root?: PNode;
  /**
   * FULL-LAYOUT preset: a complete, pre-serialized node tree (root "ROOT")
   * composed ENTIRELY of editable primitives (Section/Container/Grid/Column/
   * Div/Heading/Paragraph/Button/Image/Icon/Link/Divider). Takes precedence over
   * `root`. `sectionLayout` regenerates its ids on every insert so duplicates
   * never collide. Used by the Office Beacon full-homepage clone so every
   * element on the page is a real, selectable/editable node — no composite
   * blocks with hidden JSX.
   */
  layout?: SerializedLayout;
}

export const OB_HOMEPAGE_PRESET_ID = "ob-full-homepage";
export const OB_HOW_IT_WORKS_PRESET_ID = "ob-how-it-works";

let obHomepageLayoutCache: SerializedLayout | null = null;
let obHowItWorksLayoutCache: SerializedLayout | null = null;

/** Warm the OB homepage JSON in the background (Section Library panel). */
export const preloadObHomepageLayout = (): void => {
  void loadObHomepageLayout();
};

export const preloadObHowItWorksLayout = (): void => {
  void loadObHowItWorksLayout();
};

/** Whether a preset's layout JSON is loaded (async OB presets need preload). */
export const isPresetLayoutReady = (preset: SectionPreset): boolean => {
  if (preset.layout) return true;
  if (preset.id === OB_HOMEPAGE_PRESET_ID) return !!obHomepageLayoutCache;
  if (preset.id === OB_HOW_IT_WORKS_PRESET_ID) return !!obHowItWorksLayoutCache;
  return true;
};

export const loadObHomepageLayout = async (): Promise<SerializedLayout> => {
  if (!obHomepageLayoutCache) {
    const mod = await import("./obHomepage.json");
    obHomepageLayoutCache = mod.default as unknown as SerializedLayout;
  }
  return obHomepageLayoutCache;
};

export const loadObHowItWorksLayout = async (): Promise<SerializedLayout> => {
  if (!obHowItWorksLayoutCache) {
    const mod = await import("./obHowItWorks.json");
    obHowItWorksLayoutCache = mod.default as unknown as SerializedLayout;
  }
  return obHowItWorksLayoutCache;
};

/** Resolve a preset layout (sync for inline presets; async for lazy full-page JSON). */
export const resolvePresetLayout = async (preset: SectionPreset): Promise<SerializedLayout> => {
  if (preset.layout) return regenerateLayoutIds(preset.layout);
  if (preset.id === OB_HOMEPAGE_PRESET_ID) {
    return regenerateLayoutIds(await loadObHomepageLayout());
  }
  if (preset.id === OB_HOW_IT_WORKS_PRESET_ID) {
    return regenerateLayoutIds(await loadObHowItWorksLayout());
  }
  return sectionLayout(preset);
};

const PLACEHOLDER_IMG =
  "https://placehold.co/640x420/e2e8f0/64748b?text=Image";
const PLACEHOLDER_AVATAR =
  "https://placehold.co/96x96/e2e8f0/64748b?text=%20";
const PLACEHOLDER_LOGO = (label: string) =>
  `https://placehold.co/160x48/f1f5f9/94a3b8?text=${encodeURIComponent(label)}`;

/* ------------------------------------------------------------------ */
/* The presets                                                        */
/* ------------------------------------------------------------------ */

export const SECTION_PRESETS: SectionPreset[] = [
  /* ---- FULL PAGE — Office Beacon homepage clone ---------------- */
  {
    id: OB_HOMEPAGE_PRESET_ID,
    name: "Office Beacon — Full Homepage",
    category: "Full Page",
    description:
      "Complete OB homepage rebuilt from editable primitives — every heading, button, image, icon and layout is a real, selectable/editable node (no hidden components).",
  },
  {
    id: OB_HOW_IT_WORKS_PRESET_ID,
    name: "Office Beacon — How It Works",
    category: "Full Page",
    description:
      "Complete How It Works page matching officebeacon.com/how-it-works — fully editable builder blocks.",
  },

  /* ---- HERO (3) ------------------------------------------------- */
  {
    id: "hero-centered",
    name: "Hero — Centered",
    category: "Hero",
    description: "Big centered headline, subtext and a primary CTA.",
    root: section(sectionStyles({ bg: T.bg, py: 112 }), [
      n("Hero Section", {
        layout: "centered",
        title: "Build on-brand pages in minutes",
        highlightText: "minutes",
        highlightColor: T.primary,
        subtitle:
          "Drop in pre-built, theme-aware sections and ship a polished marketing page without a designer.",
        showCta: true,
        ctaIcon: "arrow-right",
        buttons: [
          { label: "Get started", url: "#", styles: { backgroundColor: T.primary, color: T.primaryFg } },
          { label: "Learn more", url: "#", styles: { backgroundColor: "transparent", color: T.primary } },
        ],
      }),
    ]),
  },
  {
    id: "hero-split",
    name: "Hero — Split image",
    category: "Hero",
    description: "Headline + copy on the left, image on the right.",
    root: section(sectionStyles({ bg: T.bg, py: 96, align: "left" }), [
      n("Hero Section", {
        layout: "split",
        imageUrl: PLACEHOLDER_IMG,
        title: "Everything your marketing team needs",
        highlightText: "marketing team",
        highlightColor: T.primary,
        subtitle:
          "A complete page builder with reusable sections, brand theming, and one-click publishing.",
        showCta: true,
        buttons: [{ label: "Start free trial", url: "#", styles: { backgroundColor: T.primary, color: T.primaryFg } }],
      }),
    ]),
  },
  {
    id: "hero-with-form",
    name: "Hero — With form",
    category: "Hero",
    description: "Centered headline with an inline lead-capture form.",
    root: section(sectionStyles({ bg: T.muted, py: 96, align: "center" }), [
      container(containerStyles(720), [
        heading("Start building today", { level: 1, styles: { typography: { fontSize: 44, textAlign: "center", fontWeight: 700 }, colors: { textColor: T.fg } } }),
        paragraph("Sign up and launch your first page in under five minutes.", {
          styles: { typography: { textAlign: "center", fontSize: 18 }, colors: { textColor: T.mutedFg }, spacing: { marginTop: 16, marginBottom: 24 } },
        }),
        n("Form", { submitLabel: "Request access", styles: { spacing: { marginTop: 8 } } }),
      ]),
    ]),
  },

  /* ---- FEATURES (3) -------------------------------------------- */
  {
    id: "features-grid",
    name: "Features — Grid",
    category: "Features",
    description: "Three-column icon feature grid with a heading.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        sectionHeading({
          subtitle: "FEATURES",
          title: "Everything you need to ship",
          highlightText: "ship",
          highlightColor: T.primary,
          styles: { spacing: { marginBottom: 48 } },
        }),
        n("Feature List", {
          columns: 3,
          features: [
            { title: "Theme-aware", description: "Sections adopt each tenant's brand colors automatically.", icon: "🎨" },
            { title: "One-click insert", description: "Drop a polished section onto the page in a single click.", icon: "⚡" },
            { title: "Fully editable", description: "Every inserted block is a normal, editable Craft node.", icon: "🧩" },
          ],
        }),
      ]),
    ]),
  },
  {
    id: "features-alternating",
    name: "Features — Alternating",
    category: "Features",
    description: "Image + copy rows that alternate sides.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        n("Row", { styles: { layout: { display: "flex", alignItems: "center", gap: 48 }, spacing: { marginBottom: 64 } } }, [
          n("Column", { styles: { sizing: { width: "50%" } } }, [
            n("Image", { imageUrl: PLACEHOLDER_IMG, altText: "Feature" }),
          ]),
          n("Column", { styles: { sizing: { width: "50%" } } }, [
            heading("Design once, reuse everywhere", { styles: { colors: { textColor: T.fg }, typography: { fontSize: 30, fontWeight: 700 } } }),
            paragraph("Build a section, save it, and reuse it across every page and tenant — all kept on-brand.", { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 16 } } }),
          ]),
        ]),
        n("Row", { styles: { layout: { display: "flex", alignItems: "center", gap: 48, flexDirection: "row-reverse" } } }, [
          n("Column", { styles: { sizing: { width: "50%" } } }, [
            n("Image", { imageUrl: PLACEHOLDER_IMG, altText: "Feature" }),
          ]),
          n("Column", { styles: { sizing: { width: "50%" } } }, [
            heading("Publish with confidence", { styles: { colors: { textColor: T.fg }, typography: { fontSize: 30, fontWeight: 700 } } }),
            paragraph("Preview, schedule, and publish — versioned so you can always roll back.", { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 16 } } }),
          ]),
        ]),
      ]),
    ]),
  },
  {
    id: "features-icon-list",
    name: "Features — Icon list",
    category: "Features",
    description: "Four-column compact icon list.",
    root: section(sectionStyles({ bg: T.muted }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "WHY US", title: "Built for non-designers", styles: { spacing: { marginBottom: 40 } } }),
        n("Feature List", {
          columns: 4,
          features: [
            { title: "Fast", description: "Ship in minutes.", icon: "⚡" },
            { title: "Consistent", description: "On-brand by default.", icon: "🎯" },
            { title: "Flexible", description: "Edit anything.", icon: "🧩" },
            { title: "Reliable", description: "Versioned & safe.", icon: "🛡️" },
          ],
        }),
      ]),
    ]),
  },

  /* ---- CTA (2) -------------------------------------------------- */
  {
    id: "cta-banner",
    name: "CTA — Banner",
    category: "CTA",
    description: "Full-width primary banner with a single CTA.",
    root: section(sectionStyles({ bg: T.primary, fg: T.primaryFg, py: 72, align: "center" }), [
      container(containerStyles(800), [
        heading("Ready to get started?", { styles: { colors: { textColor: T.primaryFg }, typography: { fontSize: 34, fontWeight: 700, textAlign: "center" } } }),
        paragraph("Launch your first themed page today — no design skills required.", { styles: { colors: { textColor: T.primaryFg }, typography: { textAlign: "center" }, spacing: { marginTop: 12, marginBottom: 28 } } }),
        n("Div", { styles: { layout: { display: "flex", justifyContent: "center" } } }, [
          button("Get started free", { partStyles: { backgroundColor: T.primaryFg, color: T.primary } }),
        ]),
      ]),
    ]),
  },
  {
    id: "cta-split",
    name: "CTA — Split",
    category: "CTA",
    description: "Copy on the left, action buttons on the right.",
    root: section(sectionStyles({ bg: T.card, py: 64 }), [
      container(containerStyles(), [
        n("Row", { styles: { layout: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32, flexWrap: "wrap" } } }, [
          n("Column", {}, [
            heading("Bring your brand to every page", { styles: { colors: { textColor: T.fg }, typography: { fontSize: 28, fontWeight: 700 } } }),
            paragraph("Theme-aware sections keep every tenant on-brand.", { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8 } } }),
          ]),
          n("Column", { styles: { layout: { display: "flex", gap: 12 } } }, [
            button("Start now", { partStyles: { backgroundColor: T.primary, color: T.primaryFg } }),
            button("Contact sales", { variant: "secondary", partStyles: { backgroundColor: "transparent", color: T.primary, border: `1px solid ${T.primary}` } }),
          ]),
        ]),
      ]),
    ]),
  },

  /* ---- PRICING (1) --------------------------------------------- */
  {
    id: "pricing-3tier",
    name: "Pricing — 3 tiers",
    category: "Pricing",
    description: "Three pricing cards with a highlighted middle plan.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "PRICING", title: "Simple, transparent pricing", styles: { spacing: { marginBottom: 48 } } }),
        n("Grid", { columns: 3, styles: { layout: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 } } }, [
          pricingCard("Starter", "$0", "For trying things out", ["1 site", "5 pages", "Community support"], false),
          pricingCard("Pro", "$29", "For growing teams", ["Unlimited pages", "Brand theming", "Priority support"], true),
          pricingCard("Enterprise", "Custom", "For large orgs", ["SSO & roles", "Dedicated support", "Custom SLAs"], false),
        ]),
      ]),
    ]),
  },

  /* ---- FAQ (1) -------------------------------------------------- */
  {
    id: "faq-stacked",
    name: "FAQ — Stacked",
    category: "FAQ",
    description: "Stacked question/answer pairs.",
    root: section(sectionStyles({ bg: T.muted }), [
      container(containerStyles(800), [
        sectionHeading({ subtitle: "FAQ", title: "Frequently asked questions", styles: { spacing: { marginBottom: 40 } } }),
        faqItem("Are inserted sections editable?", "Yes — every dropped section is a normal Craft block tree you can edit, restyle, or delete."),
        faqItem("Do sections match my brand?", "They use theme tokens, so they automatically adopt each tenant's brand colors."),
        faqItem("Can I insert the same section twice?", "Yes. Node ids are regenerated on insert, so duplicates never collide."),
      ]),
    ]),
  },

  /* ---- TESTIMONIALS (2) ---------------------------------------- */
  {
    id: "testimonial-quote",
    name: "Testimonial — Quote",
    category: "Testimonials",
    description: "Single large centered customer quote.",
    root: section(sectionStyles({ bg: T.card, py: 88, align: "center" }), [
      container(containerStyles(760), [
        paragraph(
          "“This cut our page-building time from days to minutes — and everything stays on-brand across all our tenants.”",
          { styles: { typography: { fontSize: 26, textAlign: "center", lineHeight: 1.5, fontWeight: 500 }, colors: { textColor: T.fg } } },
        ),
        n("Image", { imageUrl: PLACEHOLDER_AVATAR, altText: "Avatar", width: 64, height: 64, imageStyles: { borderRadius: 999 }, styles: { spacing: { marginTop: 24, marginLeft: "auto", marginRight: "auto" } } }),
        paragraph("Jordan Lee · Head of Marketing", { styles: { typography: { textAlign: "center", fontSize: 14 }, colors: { textColor: T.mutedFg }, spacing: { marginTop: 12 } } }),
      ]),
    ]),
  },
  {
    id: "testimonial-logos",
    name: "Testimonials — Quotes grid",
    category: "Testimonials",
    description: "Three short testimonial cards.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "LOVED BY TEAMS", title: "What our customers say", styles: { spacing: { marginBottom: 48 } } }),
        n("Grid", { columns: 3, styles: { layout: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 } } }, [
          quoteCard("“Effortless and on-brand every time.”", "Sam R."),
          quoteCard("“Our marketers ship without us now.”", "Alex P."),
          quoteCard("“The theming alone is worth it.”", "Priya N."),
        ]),
      ]),
    ]),
  },

  /* ---- STATS (1) ------------------------------------------------ */
  {
    id: "stats-counters",
    name: "Stats — Counters",
    category: "Stats",
    description: "Animated counter stats in a row.",
    root: section(sectionStyles({ bg: T.muted }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "BY THE NUMBERS", title: "Trusted at scale", styles: { spacing: { marginBottom: 40 } } }),
        n("Counter Section", {
          columns: 4,
          animate: true,
          cardStyle: true,
          stats: [
            { value: "4,000+", label: "Pages shipped", description: "Across every tenant." },
            { value: "99%", label: "On-brand", description: "Themed automatically." },
            { value: "5min", label: "Avg. build time", description: "From blank to live." },
            { value: "24/7", label: "Uptime", description: "Always available." },
          ],
        }),
      ]),
    ]),
  },

  /* ---- TEAM (1) ------------------------------------------------- */
  {
    id: "team-grid",
    name: "Team — Grid",
    category: "Team",
    description: "Four-up team member grid with avatars.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "OUR TEAM", title: "Meet the people behind it", styles: { spacing: { marginBottom: 48 } } }),
        n("Grid", { columns: 4, styles: { layout: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 } } }, [
          teamCard("Avery Stone", "CEO"),
          teamCard("Riley Chen", "Head of Design"),
          teamCard("Morgan Diaz", "Engineering Lead"),
          teamCard("Casey Park", "Customer Success"),
        ]),
      ]),
    ]),
  },

  /* ---- LOGOS (1) ------------------------------------------------ */
  {
    id: "logo-cloud",
    name: "Logo cloud",
    category: "Logos",
    description: "Marquee of customer logos.",
    root: section(sectionStyles({ bg: T.bg, py: 64, align: "center" }), [
      container(containerStyles(), [
        paragraph("Trusted by teams everywhere", { styles: { typography: { textAlign: "center", fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }, colors: { textColor: T.mutedFg }, spacing: { marginBottom: 32 } } }),
        n("Logo Carousel", {
          marquee: true,
          autoplay: true,
          logos: [
            PLACEHOLDER_LOGO("Acme"),
            PLACEHOLDER_LOGO("Globex"),
            PLACEHOLDER_LOGO("Initech"),
            PLACEHOLDER_LOGO("Umbrella"),
            PLACEHOLDER_LOGO("Hooli"),
          ],
        }),
      ]),
    ]),
  },

  /* ---- CONTENT (1) --------------------------------------------- */
  {
    id: "content-image",
    name: "Content + image",
    category: "Content",
    description: "Two-column rich text beside an image.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        n("Row", { styles: { layout: { display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" } } }, [
          n("Column", { styles: { sizing: { width: "50%" } } }, [
            n("Section Heading", { align: "left", subtitle: "ABOUT", title: "A better way to build pages", styles: {} }),
            paragraph("Compose pages from reusable, theme-aware sections. Marketers move fast while staying perfectly on-brand across every tenant.", { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 16, marginBottom: 24 } } }),
            button("Learn more", { partStyles: { backgroundColor: T.primary, color: T.primaryFg } }),
          ]),
          n("Column", { styles: { sizing: { width: "50%" } } }, [
            n("Image", { imageUrl: PLACEHOLDER_IMG, altText: "About" }),
          ]),
        ]),
      ]),
    ]),
  },

  /* ---- NAVIGATION (1) ------------------------------------------ */
  {
    id: "navbar-basic",
    name: "Navbar",
    category: "Navigation",
    description: "Logo, menu links and a CTA button — a full navigation bar built from editable nodes.",
    root: section(sectionStyles({ bg: T.bg, py: 0 }), [
      container({ ...containerStyles(1200), styles: { sizing: { maxWidth: 1200 }, spacing: { marginLeft: "auto", marginRight: "auto", paddingTop: 16, paddingBottom: 16 } } }, [
        row({ styles: { layout: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 } } }, [
          heading("Brand", { level: 3, styles: { typography: { fontSize: 22, fontWeight: 800 }, colors: { textColor: T.fg } } }),
          row({ styles: { layout: { display: "flex", alignItems: "center", gap: 24 } } }, [
            link("Home", { linkStyles: { color: T.fg, textDecoration: "none" } }),
            link("Features", { linkStyles: { color: T.fg, textDecoration: "none" } }),
            link("Pricing", { linkStyles: { color: T.fg, textDecoration: "none" } }),
            link("Contact", { linkStyles: { color: T.fg, textDecoration: "none" } }),
          ]),
          button("Get started", { partStyles: { backgroundColor: T.primary, color: T.primaryFg } }),
        ]),
      ]),
    ]),
  },
  {
    id: "navbar-composed-ob",
    name: "Navbar — Composable (Office Beacon)",
    category: "Navigation",
    description:
      "Full Office Beacon nav as editable blocks: logo image, dropdowns, mega menu, and CTA — add/remove/reorder any item.",
    root: section(sectionStyles({ bg: T.bg, py: 0 }), [
      n(
        "Navbar",
        {
          mode: "composed",
          sticky: true,
          ctaText: "Get Started",
          ctaUrl: "https://www.officebeacon.com/contact",
          showCta: true,
        },
        [
          row(
            {
              styles: {
                layout: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, width: "100%" },
              },
            },
            [
              n("Image", {
                imageUrl:
                  "https://www.officebeacon.com/hs-fs/hubfs/office-beacon/logos/OB%20Logo%20Colour.png?width=350&height=76&name=OB%20Logo%20Colour.png",
                altText: "Office Beacon",
                styles: { sizing: { height: 56 } },
              }),
              n("NavMenu", {}, [
                n("Nav Dropdown", { label: "Solutions", items: obNavByLabel("Solutions")?.items ?? [] }),
                n("Nav Mega", { label: "Staffing Services", columns: OB_STAFFING_MEGA_COLUMNS }),
                n("Nav Dropdown", { label: "All Industries", items: obNavByLabel("All Industries")?.items ?? [] }),
                n("Nav Link", { label: "How It Works", url: "/how-it-works" }),
                n("Nav Dropdown", { label: "About", items: obNavByLabel("About")?.items ?? [] }),
                n("Nav Link", { label: "Events", url: "https://events.officebeacon.com/" }),
                n("Nav Link", { label: "Careers", url: "https://www.officebeacon.com/careers" }),
              ]),
            ],
          ),
        ],
      ),
    ]),
  },

  /* ---- CONTACT (1) --------------------------------------------- */
  {
    id: "contact-form",
    name: "Contact Section",
    category: "Contact",
    description: "Contact details beside a lead form — every field, label and link editable.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        row({ styles: { layout: { display: "flex", gap: 48, flexWrap: "wrap", alignItems: "flex-start" } } }, [
          column({ styles: { sizing: { width: "45%" } } }, [
            n("Section Heading", { align: "left", subtitle: "GET IN TOUCH", title: "Talk to our team", styles: { spacing: { marginBottom: 16 } } }),
            paragraph("We usually reply within one business day.", { styles: { colors: { textColor: T.mutedFg }, spacing: { marginBottom: 24 } } }),
            row({ styles: { layout: { display: "flex", alignItems: "center", gap: 10 }, spacing: { marginBottom: 12 } } }, [icon("Mail"), link("hello@example.com", { linkStyles: { color: T.fg, textDecoration: "none" } })]),
            row({ styles: { layout: { display: "flex", alignItems: "center", gap: 10 }, spacing: { marginBottom: 12 } } }, [icon("Phone"), link("+1 (555) 123-4567", { linkStyles: { color: T.fg, textDecoration: "none" } })]),
            row({ styles: { layout: { display: "flex", alignItems: "center", gap: 10 } } }, [icon("MapPin"), paragraph("123 Market St, San Francisco, CA", { styles: { colors: { textColor: T.fg } } })]),
          ]),
          column({ styles: { sizing: { width: "50%" } } }, [
            n("Form", { submitLabel: "Send message" }),
          ]),
        ]),
      ]),
    ]),
  },

  /* ---- GALLERY (1) --------------------------------------------- */
  {
    id: "gallery-grid",
    name: "Gallery Section",
    category: "Gallery",
    description: "A responsive image grid — each image is an independent, selectable node.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "GALLERY", title: "Selected work", styles: { spacing: { marginBottom: 40 } } }),
        grid(3, [
          image({ imageStyles: { borderRadius: 12 } }),
          image({ imageStyles: { borderRadius: 12 } }),
          image({ imageStyles: { borderRadius: 12 } }),
          image({ imageStyles: { borderRadius: 12 } }),
          image({ imageStyles: { borderRadius: 12 } }),
          image({ imageStyles: { borderRadius: 12 } }),
        ]),
      ]),
    ]),
  },

  /* ---- TIMELINE (1) -------------------------------------------- */
  {
    id: "timeline-steps",
    name: "Timeline Section",
    category: "Timeline",
    description: "Year / title / description steps — each event is fully editable.",
    root: section(sectionStyles({ bg: T.muted }), [
      container(containerStyles(760), [
        sectionHeading({ subtitle: "OUR JOURNEY", title: "Milestones", styles: { spacing: { marginBottom: 40 } } }),
        timelineRow("2021", "Founded", "The company was founded with a simple mission."),
        timelineRow("2022", "First 1,000 customers", "We crossed our first major growth milestone."),
        timelineRow("2023", "Series A", "Raised funding to scale the platform."),
        timelineRow("2024", "Global launch", "Expanded to customers across 40+ countries."),
      ]),
    ]),
  },

  /* ---- CARDS (1) ----------------------------------------------- */
  {
    id: "card-grid",
    name: "Card Grid Section",
    category: "Cards",
    description: "Flexible image + title + description cards in a responsive grid.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "HIGHLIGHTS", title: "What we offer", styles: { spacing: { marginBottom: 40 } } }),
        grid(3, [
          contentCard("Fast delivery", "Ship polished pages in minutes, not days."),
          contentCard("On-brand", "Every section adopts your theme automatically."),
          contentCard("Fully editable", "Drag, style and rearrange every element."),
        ]),
      ]),
    ]),
  },

  /* ---- BLOG (1) ------------------------------------------------ */
  {
    id: "blog-grid",
    name: "Blog Section",
    category: "Blog",
    description: "Blog-style card grid (image, title, excerpt, link). Swap for a Collection List to make it dynamic.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        sectionHeading({ subtitle: "BLOG", title: "Latest articles", styles: { spacing: { marginBottom: 40 } } }),
        grid(3, [
          blogCard("Product", "How we rebuilt our editor", "A look behind the scenes at our new visual builder."),
          blogCard("Guides", "Design systems 101", "Everything you need to start a scalable design system."),
          blogCard("Company", "Our journey to 4,000 customers", "The lessons we learned scaling from zero."),
        ]),
      ]),
    ]),
  },

  /* ---- FOOTER (1) ---------------------------------------------- */
  {
    id: "footer-columns",
    name: "Footer",
    category: "Footer",
    description: "Multi-column footer with link groups, a divider, copyright and social icons — all editable.",
    root: section(sectionStyles({ bg: T.card, py: 56 }), [
      container(containerStyles(), [
        grid(4, [
          column({}, [
            heading("Brand", { level: 4, styles: { typography: { fontSize: 18, fontWeight: 800 }, colors: { textColor: T.fg } } }),
            paragraph("Build on-brand pages, fast.", { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8 } } }),
          ]),
          footerLinkCol("Product", ["Features", "Pricing", "Changelog"]),
          footerLinkCol("Company", ["About", "Careers", "Contact"]),
          footerLinkCol("Legal", ["Privacy", "Terms", "Security"]),
        ]),
        n("Divider", { styles: { spacing: { marginTop: 32, marginBottom: 20 } } }),
        row({ styles: { layout: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" } } }, [
          paragraph("© 2026 Brand. All rights reserved.", { styles: { typography: { fontSize: 13 }, colors: { textColor: T.mutedFg } } }),
          row({ styles: { layout: { display: "flex", alignItems: "center", gap: 14 } } }, [
            icon("Twitter", { color: T.mutedFg }),
            icon("Linkedin", { color: T.mutedFg }),
            icon("Github", { color: T.mutedFg }),
          ]),
        ]),
      ]),
    ]),
  },

  /* ---- CONTENT — badge row ------------------------------------- */
  {
    id: "badge-row",
    name: "Badge Row",
    category: "Content",
    description: "A centered row of pill badges/chips — each chip is an editable node.",
    root: section(sectionStyles({ bg: T.bg, py: 48, align: "center" }), [
      container(containerStyles(900), [
        row({ styles: { layout: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 } } }, [
          badge("Trusted"),
          badge("Secure"),
          badge("24/7 Support"),
          badge("No-code"),
          badge("Fast"),
        ]),
      ]),
    ]),
  },

  /* ---- SECTION STARTER — OB header ----------------------------- */
  {
    id: "starter-topbar-nav-hero",
    name: "Top Bar + Nav + Hero",
    category: "Hero",
    group: "Section Starters",
    description: "OB-style utility top bar, navigation bar and a hero — decomposed into editable layers.",
    root: section(sectionStyles({ bg: T.bg, py: 0 }), [
      // Utility top bar
      n("Div", { styles: { colors: { backgroundColor: T.primary }, spacing: { paddingTop: 8, paddingBottom: 8, paddingLeft: 24, paddingRight: 24 } } }, [
        row({ styles: { layout: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 20 } } }, [
          link("Support", { linkStyles: { color: T.primaryFg, textDecoration: "none", fontSize: 13 } }),
          link("Login", { linkStyles: { color: T.primaryFg, textDecoration: "none", fontSize: 13 } }),
        ]),
      ]),
      // Nav bar
      n("Div", { styles: { spacing: { paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24 } } }, [
        row({ styles: { layout: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 } } }, [
          heading("Brand", { level: 3, styles: { typography: { fontSize: 22, fontWeight: 800 }, colors: { textColor: T.fg } } }),
          row({ styles: { layout: { display: "flex", alignItems: "center", gap: 24 } } }, [
            link("Home", { linkStyles: { color: T.fg, textDecoration: "none" } }),
            link("Services", { linkStyles: { color: T.fg, textDecoration: "none" } }),
            link("About", { linkStyles: { color: T.fg, textDecoration: "none" } }),
          ]),
          button("Contact us", { partStyles: { backgroundColor: T.primary, color: T.primaryFg } }),
        ]),
      ]),
      // Hero
      n("Div", { styles: { typography: { textAlign: "center" }, spacing: { paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 } } }, [
        heading("Scale your team with Office Beacon", { level: 1, styles: { typography: { fontSize: 46, fontWeight: 800, textAlign: "center" }, colors: { textColor: T.fg } } }),
        paragraph("Hybrid teams that deliver more, for less — without the hiring overhead.", { styles: { typography: { textAlign: "center", fontSize: 18 }, colors: { textColor: T.mutedFg }, spacing: { marginTop: 16, marginBottom: 24 } } }),
        n("Div", { styles: { layout: { display: "flex", justifyContent: "center", gap: 12 } } }, [
          button("Get started", { partStyles: { backgroundColor: T.primary, color: T.primaryFg } }),
          button("Learn more", { variant: "secondary", partStyles: { backgroundColor: "transparent", color: T.primary, border: `1px solid ${T.primary}` } }),
        ]),
      ]),
    ]),
  },

  /* ---- QUICK LAYOUTS (4) --------------------------------------- */
  {
    id: "layout-1col",
    name: "Single Column",
    category: "Layout",
    group: "Quick Layouts",
    description: "Full-width stacked content column.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        column({}, [
          heading("Heading", { styles: { colors: { textColor: T.fg } } }),
          paragraph("Add your content here.", { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8 } } }),
        ]),
      ]),
    ]),
  },
  {
    id: "layout-2col",
    name: "Two Column",
    category: "Layout",
    group: "Quick Layouts",
    description: "Two equal columns that stack on mobile.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        grid(2, [placeholderCol(), placeholderCol()]),
      ]),
    ]),
  },
  {
    id: "layout-3col",
    name: "Three Column",
    category: "Layout",
    group: "Quick Layouts",
    description: "Three columns, responsive down to one.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        grid(3, [placeholderCol(), placeholderCol(), placeholderCol()]),
      ]),
    ]),
  },
  {
    id: "layout-4col",
    name: "Four Column",
    category: "Layout",
    group: "Quick Layouts",
    description: "Four columns, responsive down to one.",
    root: section(sectionStyles({ bg: T.bg }), [
      container(containerStyles(), [
        grid(4, [placeholderCol(), placeholderCol(), placeholderCol(), placeholderCol()]),
      ]),
    ]),
  },
];

/* ------------------------------------------------------------------ */
/* Card sub-builders (used by multiple presets)                       */
/* ------------------------------------------------------------------ */

function pricingCard(
  name: string,
  price: string,
  blurb: string,
  features: string[],
  highlight: boolean,
): PNode {
  return n("Column", {
    styles: {
      colors: { backgroundColor: highlight ? T.primary : T.card, textColor: highlight ? T.primaryFg : T.fg },
      spacing: { paddingTop: 32, paddingBottom: 32, paddingLeft: 28, paddingRight: 28 },
      borders: { borderRadius: 14, borderColor: T.border, borderWidth: highlight ? 0 : 1 },
    },
  }, [
    heading(name, { level: 3, styles: { typography: { fontSize: 20, fontWeight: 700 }, colors: { textColor: highlight ? T.primaryFg : T.fg } } }),
    heading(price, { level: 2, styles: { typography: { fontSize: 40, fontWeight: 800 }, colors: { textColor: highlight ? T.primaryFg : T.fg }, spacing: { marginTop: 8 } } }),
    paragraph(blurb, { styles: { colors: { textColor: highlight ? T.primaryFg : T.mutedFg }, spacing: { marginTop: 4, marginBottom: 16 } } }),
    ...features.map((f) =>
      paragraph(`✓ ${f}`, { styles: { colors: { textColor: highlight ? T.primaryFg : T.fg }, spacing: { marginTop: 8 } } }),
    ),
    n("Div", { styles: { spacing: { marginTop: 24 } } }, [
      button("Choose plan", {
        partStyles: highlight
          ? { backgroundColor: T.primaryFg, color: T.primary }
          : { backgroundColor: T.primary, color: T.primaryFg },
      }),
    ]),
  ]);
}

function faqItem(q: string, a: string): PNode {
  return n("Div", {
    styles: {
      colors: { backgroundColor: T.card },
      spacing: { paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, marginBottom: 12 },
      borders: { borderRadius: 10, borderColor: T.border, borderWidth: 1 },
    },
  }, [
    heading(q, { level: 3, styles: { typography: { fontSize: 18, fontWeight: 600 }, colors: { textColor: T.fg } } }),
    paragraph(a, { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8 } } }),
  ]);
}

function quoteCard(quote: string, author: string): PNode {
  return n("Column", {
    styles: {
      colors: { backgroundColor: T.card },
      spacing: { paddingTop: 28, paddingBottom: 28, paddingLeft: 24, paddingRight: 24 },
      borders: { borderRadius: 14, borderColor: T.border, borderWidth: 1 },
    },
  }, [
    paragraph(quote, { styles: { typography: { fontSize: 17, lineHeight: 1.6 }, colors: { textColor: T.fg } } }),
    paragraph(`— ${author}`, { styles: { typography: { fontSize: 14 }, colors: { textColor: T.mutedFg }, spacing: { marginTop: 16 } } }),
  ]);
}

function teamCard(name: string, role: string): PNode {
  return n("Column", { styles: { typography: { textAlign: "center" } } }, [
    n("Image", { imageUrl: PLACEHOLDER_AVATAR, altText: name, width: 96, height: 96, imageStyles: { borderRadius: 999 }, styles: { spacing: { marginLeft: "auto", marginRight: "auto" } } }),
    heading(name, { level: 3, styles: { typography: { fontSize: 18, fontWeight: 700, textAlign: "center" }, colors: { textColor: T.fg }, spacing: { marginTop: 16 } } }),
    paragraph(role, { styles: { typography: { textAlign: "center", fontSize: 14 }, colors: { textColor: T.mutedFg }, spacing: { marginTop: 4 } } }),
  ]);
}

function timelineRow(year: string, title: string, desc: string): PNode {
  return n("Div", {
    styles: {
      colors: { backgroundColor: T.card },
      spacing: { paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, marginBottom: 12 },
      borders: { borderRadius: 10, borderColor: T.border, borderWidth: 1 },
    },
  }, [
    heading(year, { level: 4, styles: { typography: { fontSize: 14, fontWeight: 700, letterSpacing: 1 }, colors: { textColor: T.primary } } }),
    heading(title, { level: 3, styles: { typography: { fontSize: 18, fontWeight: 600 }, colors: { textColor: T.fg }, spacing: { marginTop: 4 } } }),
    paragraph(desc, { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 6 } } }),
  ]);
}

function contentCard(title: string, desc: string): PNode {
  return n("Column", {
    styles: {
      colors: { backgroundColor: T.card },
      spacing: { paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 },
      borders: { borderRadius: 14, borderColor: T.border, borderWidth: 1 },
    },
  }, [
    n("Image", { imageUrl: PLACEHOLDER_IMG, altText: title, imageStyles: { borderRadius: 10 }, styles: { spacing: { marginBottom: 16 } } }),
    heading(title, { level: 3, styles: { typography: { fontSize: 18, fontWeight: 700 }, colors: { textColor: T.fg } } }),
    paragraph(desc, { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8 } } }),
  ]);
}

function blogCard(tag: string, title: string, excerpt: string): PNode {
  return n("Column", {
    styles: {
      colors: { backgroundColor: T.card },
      borders: { borderRadius: 14, borderColor: T.border, borderWidth: 1 },
    },
  }, [
    n("Image", { imageUrl: PLACEHOLDER_IMG, altText: title, imageStyles: { borderTopLeftRadius: 14, borderTopRightRadius: 14 } }),
    n("Div", { styles: { spacing: { paddingTop: 20, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 } } }, [
      paragraph(tag, { styles: { typography: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }, colors: { textColor: T.primary } } }),
      heading(title, { level: 3, styles: { typography: { fontSize: 19, fontWeight: 700 }, colors: { textColor: T.fg }, spacing: { marginTop: 6 } } }),
      paragraph(excerpt, { styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8, marginBottom: 12 } } }),
      link("Read more →", { linkStyles: { color: T.primary, textDecoration: "none", fontWeight: 600 } }),
    ]),
  ]);
}

function footerLinkCol(title: string, links: string[]): PNode {
  return n("Column", {}, [
    heading(title, { level: 4, styles: { typography: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }, colors: { textColor: T.fg }, spacing: { marginBottom: 12 } } }),
    ...links.map((l) =>
      n("Div", { styles: { spacing: { marginBottom: 8 } } }, [
        link(l, { linkStyles: { color: T.mutedFg, textDecoration: "none" } }),
      ]),
    ),
  ]);
}

function badge(label: string): PNode {
  return n("Div", {
    styles: {
      colors: { backgroundColor: T.muted, textColor: T.fg },
      spacing: { paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 },
      borders: { borderRadius: 999, borderColor: T.border, borderWidth: 1 },
      layout: { display: "inline-block" },
    },
  }, [
    paragraph(label, { styles: { typography: { fontSize: 13, fontWeight: 600 }, colors: { textColor: T.fg } } }),
  ]);
}

function placeholderCol(): PNode {
  return n("Column", {
    styles: {
      colors: { backgroundColor: T.muted },
      spacing: { paddingTop: 32, paddingBottom: 32, paddingLeft: 24, paddingRight: 24 },
      borders: { borderRadius: 10 },
      typography: { textAlign: "center" },
    },
  }, [
    paragraph("Column", { styles: { typography: { textAlign: "center" }, colors: { textColor: T.mutedFg } } }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Layout assembly + id regeneration (collision-free insert)          */
/* ------------------------------------------------------------------ */

let idCounter = 0;
/** Generate a process-unique node id (mirrors Craft's random id scheme). */
const freshId = (): string =>
  `sec_${Date.now().toString(36)}_${(idCounter++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Flatten a preset's `PNode` tree into a `SerializedLayout` node-map whose root
 * is "ROOT" (a wrapper) carrying the preset Section as its single child. FRESH
 * ids are minted for every node on each call, so inserting the same preset
 * twice produces two fully-distinct node trees that never collide.
 *
 * The returned shape matches what `layoutToCraft` + `buildTreeFromSerializedMap`
 * (the TemplatesPanel insert path we mirror) accept: ROOT's children become the
 * new top-level blocks on the canvas.
 */
const regenerateLayoutIds = regenerateCraftLayoutIds;

export const sectionLayout = (preset: SectionPreset): SerializedLayout => {
  // Full-layout preset (e.g. the OB homepage): a complete primitive node tree —
  // just regenerate its ids so every insert is a fresh, collision-free copy.
  if (preset.layout) return regenerateLayoutIds(preset.layout);
  if (preset.id === OB_HOMEPAGE_PRESET_ID) {
    if (!obHomepageLayoutCache) {
      throw new Error("Office Beacon homepage layout is still loading");
    }
    return regenerateLayoutIds(obHomepageLayoutCache);
  }
  if (preset.id === OB_HOW_IT_WORKS_PRESET_ID) {
    if (!obHowItWorksLayoutCache) {
      throw new Error("Office Beacon How It Works layout is still loading");
    }
    return regenerateLayoutIds(obHowItWorksLayoutCache);
  }

  const nodes: SerializedLayout["nodes"] = {};

  const walk = (node: PNode, parent: string): string => {
    const id = freshId();
    const childIds = (node.nodes ?? []).map((c) => walk(c, id));
    nodes[id] = {
      type: node.type,
      isCanvas: node.isCanvas ?? false,
      props: (node.props ?? {}) as Record<string, unknown>,
      displayName: node.displayName ?? node.type.resolvedName,
      custom: {},
      parent,
      hidden: false,
      nodes: childIds,
      linkedNodes: {},
    };
    return id;
  };

  const rootChildId = preset.root ? walk(preset.root, "ROOT") : null;
  nodes["ROOT"] = {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: {},
    displayName: "Section",
    custom: {},
    parent: null,
    hidden: false,
    nodes: rootChildId ? [rootChildId] : [],
    linkedNodes: {},
  };

  return { schemaVersion: "2.0", root: "ROOT", nodes };
};

/** Distinct categories, in display order (for the panel filter chips). */
export const SECTION_CATEGORIES: SectionCategory[] = [
  "Full Page",
  "Hero",
  "Navigation",
  "Features",
  "CTA",
  "Pricing",
  "FAQ",
  "Testimonials",
  "Stats",
  "Team",
  "Logos",
  "Contact",
  "Gallery",
  "Timeline",
  "Blog",
  "Cards",
  "Footer",
  "Content",
  "Layout",
];

/** Toolbox groups in display order (Section Library panel headers). */
export const SECTION_GROUPS: SectionGroup[] = [
  "Built-in Components",
  "Section Starters",
  "Quick Layouts",
];

/** The group a preset belongs to (defaults to Built-in Components). */
export const presetGroup = (p: SectionPreset): SectionGroup =>
  p.group ?? "Built-in Components";
