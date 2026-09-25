/** Shared templateKey + bandIndex (+ stable id) for starter section extraction. */
export type StarterSectionBand = {
  readonly id: string;
  readonly templateKey: string;
  readonly bandIndex: number;
};

/** Preserve literal band entries and validate ids + bandIndex at module load. */
export function defineStarterSectionBands<const T extends readonly StarterSectionBand[]>(
  entries: T,
): T {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate starter section band id: ${entry.id}`);
    }
    seen.add(entry.id);
    if (!Number.isInteger(entry.bandIndex) || entry.bandIndex < 0) {
      throw new Error(`Invalid bandIndex for starter section band ${entry.id}`);
    }
  }
  return entries;
}

export const STARTER_SECTION_BANDS = defineStarterSectionBands([
  { id: "saas-hero", templateKey: "tpl-saas-landing", bandIndex: 0 },
  { id: "saas-features", templateKey: "tpl-saas-landing", bandIndex: 1 },
  { id: "saas-logo-cloud", templateKey: "tpl-saas-landing", bandIndex: 2 },
  { id: "saas-testimonial", templateKey: "tpl-saas-landing", bandIndex: 3 },
  { id: "saas-pricing", templateKey: "tpl-saas-landing", bandIndex: 4 },
  { id: "saas-cta", templateKey: "tpl-saas-landing", bandIndex: 5 },
  { id: "marketing-hero-split", templateKey: "tpl-marketing-hero", bandIndex: 0 },
  { id: "marketing-stats", templateKey: "tpl-marketing-hero", bandIndex: 1 },
  { id: "pricing-page-pricing", templateKey: "tpl-pricing", bandIndex: 1 },
  { id: "pricing-page-faq", templateKey: "tpl-pricing", bandIndex: 2 },
  { id: "pricing-page-cta", templateKey: "tpl-pricing", bandIndex: 3 },
  { id: "faq-page-faq", templateKey: "tpl-faq", bandIndex: 1 },
  { id: "faq-page-cta", templateKey: "tpl-faq", bandIndex: 2 },
  { id: "contact-form", templateKey: "tpl-contact", bandIndex: 1 },
  { id: "contact-faq", templateKey: "tpl-contact", bandIndex: 2 },
  { id: "about-team", templateKey: "tpl-about", bandIndex: 3 },
  { id: "homepage-hero", templateKey: "tpl-homepage", bandIndex: 0 },
  { id: "features-page-features", templateKey: "tpl-features", bandIndex: 1 },
  { id: "testimonials-quote", templateKey: "tpl-testimonials", bandIndex: 1 },
  { id: "testimonials-grid", templateKey: "tpl-testimonials", bandIndex: 2 },
  { id: "landing-lead-gen", templateKey: "tpl-landing", bandIndex: 0 },
] as const);
