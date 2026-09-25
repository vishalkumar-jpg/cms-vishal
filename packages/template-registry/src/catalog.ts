/**
 * Built-in starter template catalog (metadata only).
 * Kept in sync with `apps/api/src/database/seed/template-skeletons.seed.ts`.
 *
 * No layout JSON / copy-on-create — runtime layouts live in skeleton seeds.
 */
import type { TemplateRegistrationInput } from "./schema";
import { createTemplateRegistry, type TemplateRegistry } from "./registry";

const CATALOG_EPOCH = "2026-08-06T00:00:00.000Z";
const BUILTIN_CATALOG_VERSION = "1.4.0";

const freezeSeed = (
  seed: TemplateRegistrationInput,
): TemplateRegistrationInput => {
  Object.freeze(seed.tags);
  Object.freeze(seed.supportedPageTypes);
  return Object.freeze(seed);
};

const meta = (
  partial: Omit<
    TemplateRegistrationInput,
    "createdAt" | "updatedAt" | "thumbnail" | "version"
  > & { thumbnail?: string },
): TemplateRegistrationInput => ({
  ...partial,
  version: BUILTIN_CATALOG_VERSION,
  thumbnail: partial.thumbnail ?? `/templates/previews/${partial.id}-thumb.svg`,
  createdAt: CATALOG_EPOCH,
  updatedAt: CATALOG_EPOCH,
});

/** Built-in platform starters — metadata mirror of skeleton seed defs (PR #59). */
const BUILTIN_TEMPLATE_SEED_LIST: TemplateRegistrationInput[] = [
  meta({
    id: "tpl-blank",
    displayName: "Blank Page",
    description: "Clean canvas with a light heading — start from scratch.",
    category: "utility",
    supportedPageTypes: ["generic-content"],
    tags: ["blank", "starter", "utility", "content"],
    status: "published",
  }),
  meta({
    id: "tpl-saas-landing",
    displayName: "SaaS Landing",
    description: "Campaign landing with hero, features, social proof, pricing, and CTA.",
    category: "campaign",
    supportedPageTypes: ["landing"],
    tags: ["saas", "landing", "campaign", "startup", "product", "marketing"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-marketing-hero",
    displayName: "Marketing Hero",
    description: "Split hero with stats, content band, features, and a closing CTA.",
    category: "marketing",
    supportedPageTypes: ["landing"],
    tags: ["marketing", "hero", "landing", "startup", "agency", "business"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-portfolio",
    displayName: "Portfolio",
    description: "Project gallery, testimonial, and contact CTA for creative portfolios.",
    category: "marketing",
    supportedPageTypes: ["about"],
    tags: ["portfolio", "showcase", "agency", "creative", "business"],
    status: "published",
  }),
  meta({
    id: "tpl-contact",
    displayName: "Contact Page",
    description: "Contact details, inquiry form, and FAQ for support pages.",
    category: "marketing",
    supportedPageTypes: ["contact"],
    tags: ["contact", "form", "lead", "business", "company", "services"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-about",
    displayName: "About",
    description: "Company story with stats, team grid, and a closing CTA.",
    category: "marketing",
    supportedPageTypes: ["about"],
    tags: ["about", "trust", "team", "company", "business", "agency"],
    status: "published",
  }),
  meta({
    id: "tpl-landing",
    displayName: "Landing Page",
    description: "Lead-gen landing with inline form, logo cloud, FAQ, and CTA.",
    category: "campaign",
    supportedPageTypes: ["landing"],
    tags: ["landing", "lead-gen", "campaign", "marketing", "startup", "agency"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-thank-you",
    displayName: "Thank You Page",
    description: "Post-submit confirmation with next steps and secondary actions.",
    category: "campaign",
    supportedPageTypes: ["thank-you"],
    tags: ["thank-you", "conversion", "post-submit", "marketing", "landing"],
    status: "published",
  }),
  meta({
    id: "tpl-404",
    displayName: "404 Page",
    description: "Friendly not-found page with quick links and a home CTA.",
    category: "utility",
    supportedPageTypes: ["utility"],
    tags: ["error", "404", "utility", "content"],
    status: "published",
  }),
  meta({
    id: "tpl-privacy-policy",
    displayName: "Privacy Policy",
    description: "Legal prose starter with scannable policy section headings.",
    category: "legal",
    supportedPageTypes: ["legal"],
    tags: ["legal", "privacy", "documentation", "content"],
    status: "published",
  }),
  meta({
    id: "tpl-terms",
    displayName: "Terms & Conditions",
    description: "Terms of use starter with scannable legal section headings.",
    category: "legal",
    supportedPageTypes: ["legal"],
    tags: ["legal", "terms", "documentation", "content"],
    status: "published",
  }),
  meta({
    id: "tpl-generic-content",
    displayName: "Generic Content Page",
    description: "Long-form article starter with hero image and related reading band.",
    category: "content",
    supportedPageTypes: ["generic-content"],
    tags: ["generic", "prose", "content", "documentation", "business"],
    status: "published",
  }),
  meta({
    id: "tpl-homepage",
    displayName: "Homepage",
    description: "Primary marketing home with hero, proof, services, and conversion CTA.",
    category: "marketing",
    supportedPageTypes: ["homepage"],
    tags: ["home", "brand", "conversion", "business", "company", "marketing"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-services",
    displayName: "Services",
    description: "Services overview with offering cards, benefits, and contact CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["services", "offerings", "business", "company", "agency", "marketing"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-service-detail",
    displayName: "Service Detail",
    description: "Sell one service line with benefits, proof, and related offerings.",
    category: "marketing",
    supportedPageTypes: ["service-detail"],
    tags: ["service", "services", "business", "company", "marketing", "content"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-industry-detail",
    displayName: "Industry Detail",
    description: "Vertical landing page with outcomes, proof, and related services.",
    category: "marketing",
    supportedPageTypes: ["industry-detail"],
    tags: ["industry", "vertical", "services", "business", "company", "marketing"],
    status: "published",
  }),
  meta({
    id: "tpl-pricing",
    displayName: "Pricing",
    description: "Pricing page with plan comparison, FAQ, and sales CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["pricing", "plans", "conversion", "product", "startup", "marketing"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-team",
    displayName: "Team",
    description: "Team page with culture intro, member grid, and careers CTA.",
    category: "marketing",
    supportedPageTypes: ["about"],
    tags: ["team", "people", "culture", "company", "business", "agency"],
    status: "published",
  }),
  meta({
    id: "tpl-careers",
    displayName: "Careers",
    description: "Employer brand page with culture story, open roles, and apply CTA.",
    category: "marketing",
    supportedPageTypes: ["careers"],
    tags: ["careers", "employer-brand", "company", "business", "hiring", "team"],
    status: "published",
  }),
  meta({
    id: "tpl-faq",
    displayName: "FAQ",
    description: "Support hub with common questions and contact CTA.",
    category: "content",
    supportedPageTypes: ["generic-content"],
    tags: ["faq", "support", "help", "content", "services", "documentation"],
    status: "published",
  }),
  meta({
    id: "tpl-features",
    displayName: "Features",
    description: "Product features page with benefit grid and conversion CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["features", "product", "marketing", "startup", "saas", "business"],
    status: "published",
  }),
  meta({
    id: "tpl-testimonials",
    displayName: "Testimonials",
    description: "Social proof page with customer quotes and a closing CTA.",
    category: "marketing",
    supportedPageTypes: ["generic-content"],
    tags: ["testimonials", "social-proof", "marketing", "company", "business", "agency"],
    status: "published",
  }),
  meta({
    id: "tpl-product-landing",
    displayName: "Product Landing",
    description: "Product launch landing with hero, features, proof, and pricing CTA.",
    category: "campaign",
    supportedPageTypes: ["landing"],
    tags: ["product", "landing", "marketing", "startup", "pricing", "campaign"],
    status: "published",
    featured: true,
  }),
  meta({
    id: "tpl-case-study",
    displayName: "Case Study",
    description: "Customer story with challenge, results, proof stats, and CTA.",
    category: "content",
    supportedPageTypes: ["generic-content"],
    tags: ["case-study", "portfolio", "content", "business", "marketing", "company"],
    status: "published",
  }),
  meta({
    id: "tpl-blog-listing",
    displayName: "Blog Home",
    description: "Blog index with article cards — bind a Collection List for live posts.",
    category: "content",
    supportedPageTypes: ["blog-listing"],
    tags: ["blog", "listing", "content", "marketing", "company", "documentation"],
    status: "published",
  }),
  meta({
    id: "tpl-blog-detail",
    displayName: "Blog Post",
    description: "Single article layout with hero image, body prose, and related posts.",
    category: "content",
    supportedPageTypes: ["blog-detail"],
    tags: ["blog", "article", "content", "marketing", "documentation"],
    status: "published",
  }),
  meta({
    id: "tpl-resource-listing",
    displayName: "Resource Listing",
    description: "Index of guides, PDFs, and case studies with download cards.",
    category: "content",
    supportedPageTypes: ["resource-listing"],
    tags: ["resources", "listing", "content", "documentation", "marketing"],
    status: "published",
  }),
  meta({
    id: "tpl-resource-detail",
    displayName: "Resource Detail",
    description: "Single resource page with summary, download CTA, and related items.",
    category: "content",
    supportedPageTypes: ["resource-detail"],
    tags: ["resource", "download", "content", "documentation", "marketing"],
    status: "published",
  }),
];

export const BUILTIN_TEMPLATE_SEEDS: readonly TemplateRegistrationInput[] =
  Object.freeze(BUILTIN_TEMPLATE_SEED_LIST.map(freezeSeed));

export const BUILTIN_TEMPLATE_IDS: readonly string[] = Object.freeze(
  BUILTIN_TEMPLATE_SEEDS.map((t) => t.id),
);

/** Create a registry pre-loaded with the built-in starter catalog. */
export function createBuiltinTemplateRegistry(): TemplateRegistry {
  const registry = createTemplateRegistry();
  for (const seed of BUILTIN_TEMPLATE_SEEDS) {
    registry.register(seed);
  }
  return registry;
}
