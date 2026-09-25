import type { TemplateCatalogCategory } from "@/views/template-catalog/types";
import { STARTER_SECTION_BANDS, type StarterSectionBand } from "@ob-cms/shared";

export const STARTER_SECTION_CATEGORIES = [
  "Hero",
  "Features",
  "Social Proof",
  "Pricing",
  "FAQ",
  "CTA",
  "Contact",
  "Content",
  "Team",
  "Stats",
] as const;

export type StarterSectionCategory = (typeof STARTER_SECTION_CATEGORIES)[number];

/** Curated extractable bands from published starter skeleton layouts. */
export type StarterSectionCatalogEntry = StarterSectionBand & {
  title: string;
  description: string;
  category: StarterSectionCategory;
  /** Source starter metadata category for optional filtering. */
  starterCategory: TemplateCatalogCategory;
};

/** Preserve literal catalog entries and validate ids + bandIndex at module load. */
export function defineStarterSectionCatalog<const T extends readonly StarterSectionCatalogEntry[]>(
  entries: T,
): T {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate starter section catalog id: ${entry.id}`);
    }
    seen.add(entry.id);
    if (!Number.isInteger(entry.bandIndex) || entry.bandIndex < 0) {
      throw new Error(`Invalid bandIndex for starter section catalog entry ${entry.id}`);
    }
  }
  return entries;
}

const STARTER_SECTION_DISPLAY: Record<
  StarterSectionBand["id"],
  Omit<StarterSectionCatalogEntry, keyof StarterSectionBand>
> = {
  "saas-hero": {
    title: "SaaS Hero",
    description: "Centered hero with headline, subtitle, and primary CTA.",
    category: "Hero",
    starterCategory: "campaign",
  },
  "saas-features": {
    title: "Feature Grid",
    description: "Three-column feature list with section heading.",
    category: "Features",
    starterCategory: "campaign",
  },
  "saas-logo-cloud": {
    title: "Logo Cloud",
    description: "Trusted-by marquee with customer logos.",
    category: "Social Proof",
    starterCategory: "campaign",
  },
  "saas-testimonial": {
    title: "Testimonial Quote",
    description: "Single customer quote band for social proof.",
    category: "Social Proof",
    starterCategory: "campaign",
  },
  "saas-pricing": {
    title: "Pricing Table",
    description: "Three-tier pricing cards with highlighted plan.",
    category: "Pricing",
    starterCategory: "campaign",
  },
  "saas-cta": {
    title: "Closing CTA",
    description: "Muted background band with headline and button.",
    category: "CTA",
    starterCategory: "campaign",
  },
  "marketing-hero-split": {
    title: "Split Marketing Hero",
    description: "Split hero with image and primary CTA.",
    category: "Hero",
    starterCategory: "marketing",
  },
  "marketing-stats": {
    title: "Stats Band",
    description: "Animated counter stats with section heading.",
    category: "Stats",
    starterCategory: "marketing",
  },
  "pricing-page-pricing": {
    title: "Pricing Plans",
    description: "Pricing cards pulled from the pricing starter.",
    category: "Pricing",
    starterCategory: "marketing",
  },
  "pricing-page-faq": {
    title: "Pricing FAQ",
    description: "Accordion FAQ band for plan questions.",
    category: "FAQ",
    starterCategory: "marketing",
  },
  "pricing-page-cta": {
    title: "Pricing CTA",
    description: "Post-pricing call to action.",
    category: "CTA",
    starterCategory: "marketing",
  },
  "faq-page-faq": {
    title: "FAQ Accordion",
    description: "Support FAQ accordion from the FAQ starter.",
    category: "FAQ",
    starterCategory: "utility",
  },
  "faq-page-cta": {
    title: "Support CTA",
    description: "Help visitors reach contact or live support.",
    category: "CTA",
    starterCategory: "utility",
  },
  "contact-form": {
    title: "Contact Form",
    description: "Two-column contact details with inquiry form.",
    category: "Contact",
    starterCategory: "marketing",
  },
  "contact-faq": {
    title: "Contact FAQ",
    description: "Quick answers below the contact form.",
    category: "FAQ",
    starterCategory: "marketing",
  },
  "about-team": {
    title: "Team Grid",
    description: "Team member cards with roles and photos.",
    category: "Team",
    starterCategory: "marketing",
  },
  "homepage-hero": {
    title: "Homepage Hero",
    description: "Primary homepage hero from the homepage starter.",
    category: "Hero",
    starterCategory: "marketing",
  },
  "features-page-features": {
    title: "Product Features",
    description: "Feature grid from the features starter page.",
    category: "Features",
    starterCategory: "marketing",
  },
  "testimonials-quote": {
    title: "Featured Testimonial",
    description: "Large customer quote band for social proof.",
    category: "Social Proof",
    starterCategory: "marketing",
  },
  "testimonials-grid": {
    title: "Customer Quotes Grid",
    description: "Three-up testimonial cards from the testimonials starter.",
    category: "Social Proof",
    starterCategory: "marketing",
  },
  "landing-lead-gen": {
    title: "Lead Gen Hero",
    description: "Campaign hero with inline offer form.",
    category: "Hero",
    starterCategory: "campaign",
  },
};

export const STARTER_SECTION_CATALOG = defineStarterSectionCatalog(
  STARTER_SECTION_BANDS.map((band) => ({
    ...band,
    ...STARTER_SECTION_DISPLAY[band.id],
  })),
);

export function filterStarterSectionCatalog(
  entries: readonly StarterSectionCatalogEntry[],
  search: string,
  category: StarterSectionCategory | "all",
): StarterSectionCatalogEntry[] {
  const q = search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (!q) return true;
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q) ||
      entry.templateKey.toLowerCase().includes(q)
    );
  });
}

/** Unique template keys referenced by the catalog (for skeleton prefetch). */
export function starterSectionTemplateKeys(
  entries: readonly StarterSectionCatalogEntry[] = STARTER_SECTION_CATALOG,
): string[] {
  return [...new Set(entries.map((entry) => entry.templateKey))];
}
