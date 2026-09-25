/**
 * CMS shared component families (PR #3).
 *
 * Typed catalog mapping product families → variants, configuration contracts,
 * and today's @ob-cms/blocks registry names / section presets.
 *
 * Intentionally NOT wired into the renderer or builder in this PR.
 * Existing pages (including the homepage preset) remain unchanged.
 *
 * Catalog typing uses `as const satisfies` so family-specific accessors keep
 * literal variant/field unions (e.g. hero variants[0] is `"homepage"`).
 *
 * @see docs/cms/shared-component-strategy.md
 * @see docs/cms/template-architecture.md §4–§5
 */

/** Stable product-level family ids (not Craft resolvedNames). */
export const COMPONENT_FAMILY_IDS = [
  "hero",
  "cta",
  "cards",
  "testimonials",
  "faq",
  "team",
  "timeline",
  "forms",
  "logo-cloud",
  "rich-content",
  "navigation",
  "footer",
  "roles-matrix",
  "related-links",
] as const;

export type ComponentFamilyId = (typeof COMPONENT_FAMILY_IDS)[number];

export const HERO_VARIANTS = [
  "homepage",
  "service",
  "industry",
  "career",
  "landing",
] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const CTA_VARIANTS = ["primary", "banner", "inline"] as const;
export type CtaVariant = (typeof CTA_VARIANTS)[number];

export const CARDS_VARIANTS = [
  "feature",
  "service",
  "industry",
  "resource",
] as const;
export type CardsVariant = (typeof CARDS_VARIANTS)[number];

/** Configuration field keys for a family (contract; not a Zod schema). */
export interface ComponentFamilyConfigContract<
  TFields extends readonly string[] = readonly string[],
  TVariants extends readonly string[] = readonly string[],
> {
  /** Fields editors typically fill for this family. */
  fields: TFields;
  /** Named presentation variants (empty if compositional-only today). */
  variants: TVariants;
}

export interface ComponentFamilyDefinition<
  TId extends ComponentFamilyId = ComponentFamilyId,
  TFields extends readonly string[] = readonly string[],
  TVariants extends readonly string[] = readonly string[],
> {
  id: TId;
  label: string;
  config: ComponentFamilyConfigContract<TFields, TVariants>;
  /**
   * Existing Craft registry resolvedNames that implement (or partially cover)
   * this family today. Empty when the family is still a documented gap.
   */
  registryNames: readonly string[];
  /** Related section preset ids from the admin Section Library (if any). */
  sectionPresetIds: readonly string[];
  /**
   * Prefer synchronizing multi-page content via Reusable Blocks
   * (testimonials, FAQ, chrome) rather than duplicating page JSON.
   */
  preferReusableBlock: boolean;
  notes?: string;
}

/** Structural constraint for the catalog (keeps `as const` literals). */
type ComponentFamilyCatalogEntry = {
  readonly id: ComponentFamilyId;
  readonly label: string;
  readonly config: {
    readonly fields: readonly string[];
    readonly variants: readonly string[];
  };
  readonly registryNames: readonly string[];
  readonly sectionPresetIds: readonly string[];
  readonly preferReusableBlock: boolean;
  readonly notes?: string;
};

export const COMPONENT_FAMILIES = {
  hero: {
    id: "hero",
    label: "Hero",
    config: {
      fields: [
        "title",
        "subtitle",
        "image",
        "background",
        "ctaButtons",
        "alignment",
        "visibility",
        "variant",
      ],
      variants: HERO_VARIANTS,
    },
    registryNames: ["Hero Section"],
    sectionPresetIds: [
      "hero-centered",
      "hero-split",
      "hero-with-form",
      "starter-topbar-nav-hero",
    ],
    preferReusableBlock: false,
    notes:
      "Use variants (homepage|service|industry|career|landing); never HomepageHero forks. Today's layout prop (centered|split) is a low-level knob inside the family.",
  },
  cta: {
    id: "cta",
    label: "CTA",
    config: {
      fields: [
        "title",
        "description",
        "buttons",
        "styleVariant",
        "visibility",
      ],
      variants: CTA_VARIANTS,
    },
    registryNames: ["Floating CTA", "Button"],
    sectionPresetIds: ["cta-banner", "cta-split"],
    preferReusableBlock: false,
    notes: "CTA bands are often preset compositions of text + buttons.",
  },
  cards: {
    id: "cards",
    label: "Cards",
    config: {
      fields: ["title", "description", "image", "link", "metadata"],
      variants: CARDS_VARIANTS,
    },
    registryNames: ["Feature List", "Card", "Article Card Grid", "Step Cards"],
    sectionPresetIds: [
      "features-grid",
      "features-alternating",
      "features-icon-list",
      "card-grid",
      "blog-grid",
    ],
    preferReusableBlock: false,
    notes:
      "Prefer Cards family + variants (feature|service|industry|resource) over page-named card grids.",
  },
  testimonials: {
    id: "testimonials",
    label: "Testimonials",
    config: {
      fields: ["quote", "author", "role", "company", "image"],
      variants: ["quote-carousel", "video-carousel", "quotes-grid"],
    },
    registryNames: ["Video Testimonial Carousel"],
    sectionPresetIds: ["testimonial-quote", "testimonial-logos"],
    preferReusableBlock: true,
  },
  faq: {
    id: "faq",
    label: "FAQ",
    config: {
      fields: ["question", "answer", "ordering", "visibility"],
      variants: ["stacked", "grouped"],
    },
    registryNames: ["Accordion"],
    sectionPresetIds: ["faq-stacked"],
    preferReusableBlock: true,
    notes: "Product name FAQ; registry block remains Accordion.",
  },
  team: {
    id: "team",
    label: "Team",
    config: {
      fields: ["memberName", "role", "image", "description"],
      variants: ["grid"],
    },
    registryNames: ["Team Grid"],
    sectionPresetIds: ["team-grid"],
    preferReusableBlock: false,
  },
  timeline: {
    id: "timeline",
    label: "Timeline",
    config: {
      fields: ["date", "title", "description"],
      variants: ["process", "history", "steps"],
    },
    registryNames: ["Timeline", "Event Timeline", "Step Cards"],
    sectionPresetIds: ["timeline-steps"],
    preferReusableBlock: false,
    notes: "Consolidate overlapping timeline blocks via variants over time.",
  },
  forms: {
    id: "forms",
    label: "Forms",
    config: {
      fields: ["fieldsReference", "cta", "successState", "visibility"],
      variants: ["standard", "stepper", "newsletter"],
    },
    registryNames: ["Form", "Stepper Form", "Newsletter"],
    sectionPresetIds: ["contact-form"],
    preferReusableBlock: false,
  },
  "logo-cloud": {
    id: "logo-cloud",
    label: "Logo cloud",
    config: {
      fields: ["logos", "marquee", "visibility"],
      variants: ["partners", "systems"],
    },
    registryNames: ["Logo Carousel"],
    sectionPresetIds: ["logo-cloud"],
    preferReusableBlock: true,
  },
  "rich-content": {
    id: "rich-content",
    label: "Rich content",
    config: {
      fields: ["body", "embeds"],
      variants: ["article", "seo-prose", "resource"],
    },
    registryNames: [],
    sectionPresetIds: ["content-image"],
    preferReusableBlock: false,
    notes:
      "Collection-backed detail pages: body owned by content record (PR #2 §1.2.1).",
  },
  navigation: {
    id: "navigation",
    label: "Navigation",
    config: {
      fields: ["structure", "topbar", "visibility"],
      variants: ["full-mega", "simplified-lp"],
    },
    registryNames: [],
    sectionPresetIds: ["navbar-basic", "navbar-composed-ob"],
    preferReusableBlock: true,
    notes: "Prefer Reusable Block / shared nav for sync across pages.",
  },
  footer: {
    id: "footer",
    label: "Footer",
    config: {
      fields: ["columns", "social", "copyright", "visibility"],
      variants: ["standard"],
    },
    registryNames: [],
    sectionPresetIds: ["footer-columns"],
    preferReusableBlock: true,
  },
  "roles-matrix": {
    id: "roles-matrix",
    label: "Roles matrix",
    config: {
      fields: ["roles", "capabilities"],
      variants: ["two-column", "accordion"],
    },
    registryNames: [],
    sectionPresetIds: [],
    preferReusableBlock: false,
    notes:
      "Documented gap for Service/Industry templates (PR #2 §4.14). Composition lands in a later PR.",
  },
  "related-links": {
    id: "related-links",
    label: "Related links",
    config: {
      fields: ["relatedServices", "relatedIndustries"],
      variants: ["service-cards", "industry-cards"],
    },
    registryNames: [],
    sectionPresetIds: [],
    preferReusableBlock: false,
    notes:
      "Documented gap (PR #2 §4.15). Relationship IDs owned by the page; cards resolved for display.",
  },
} as const satisfies Record<ComponentFamilyId, ComponentFamilyCatalogEntry>;

export type ComponentFamiliesCatalog = typeof COMPONENT_FAMILIES;

/** Ordered list for docs / iteration. */
export const COMPONENT_FAMILY_LIST = COMPONENT_FAMILY_IDS.map(
  (id) => COMPONENT_FAMILIES[id],
);

export function getComponentFamily<K extends ComponentFamilyId>(
  id: K,
): ComponentFamiliesCatalog[K] {
  return COMPONENT_FAMILIES[id];
}

/** Map a Craft registry resolvedName to zero or more product families. */
export function familiesForRegistryName(
  resolvedName: string,
): ComponentFamiliesCatalog[ComponentFamilyId][] {
  return COMPONENT_FAMILY_LIST.filter((f) =>
    (f.registryNames as readonly string[]).includes(resolvedName),
  );
}
