import { z } from "zod";
import { styleModelSchema } from "./styles";

/**
 * Per-block zod prop-schemas for all 28 OB-CMS blocks. The manifest prop lists
 * (BLOCK-REGISTRY-MANIFEST.md) are the contract. Every block carries the shared
 * `styles` StyleModel. Schemas are intentionally lenient (passthrough + sane
 * defaults) so real exported props round-trip without being dropped, while
 * still filling defaults for missing props during the repair pass.
 *
 * Keys MUST match the Craft.js `type.resolvedName` (display names with spaces).
 */

/* shared fragments ------------------------------------------------- */
const styles = styleModelSchema.optional();
const linkItem = z.object({ label: z.string().optional(), url: z.string().optional() }).passthrough();
const minus = (shape: z.ZodRawShape) => z.object(shape).passthrough();

/* ---- canvas / layout primitives --------------------------------- */
/** Matches Container runtime default in `@ob-cms/blocks` layout.tsx. */
export const CONTAINER_DEFAULT_MAX_WIDTH = 1200;
/** Matches Column / Row / Group flex child default. */
export const FLEX_CHILD_DEFAULT_FLEX = 1;

export const sectionSchema = minus({ sectionId: z.string().optional(), tag: z.string().optional(), styles });
export const containerSchema = minus({ maxWidth: z.union([z.number(), z.string()]).optional(), styles });
export const rowSchema = minus({ styles });
export const columnSchema = minus({ flex: z.union([z.number(), z.string()]).optional(), styles });
export const gridSchema = minus({ columns: z.number().optional(), styles });
export const sliderSchema = minus({
  slidesVisible: z.number().optional(),
  gap: z.number().optional(),
  showArrows: z.boolean().optional(),
  autoplay: z.boolean().optional().default(true),
  autoplayInterval: z.number().optional().default(5000),
  styles,
});
export const spacerSchema = minus({ height: z.number().optional(), styles });
export const cardSchema = minus({ styles });
export const groupSchema = minus({ styles });
export const divSchema = minus({ tag: z.string().optional(), styles });

/* ---- interactive & showcase blocks ------------------------------ */
export const tabsSchema = minus({
  tabs: z
    .array(z.object({ label: z.string().optional(), content: z.string().optional() }).passthrough())
    .optional(),
  partStyles: z.record(z.unknown()).optional(),
  styles,
});
export const accordionSchema = minus({
  items: z
    .array(z.object({ title: z.string().optional(), content: z.string().optional() }).passthrough())
    .optional(),
  allowMultiple: z.boolean().optional(),
  styles,
});
export const modalSchema = minus({
  triggerLabel: z.string().optional(),
  title: z.string().optional(),
  styles,
});
export const pricingTableSchema = minus({
  plans: z
    .array(
      z
        .object({
          name: z.string().optional(),
          price: z.string().optional(),
          period: z.string().optional(),
          featuresText: z.string().optional(),
          ctaLabel: z.string().optional(),
          ctaUrl: z.string().optional(),
          featured: z.boolean().optional(),
        })
        .passthrough(),
    )
    .optional(),
  styles,
});
export const teamGridSchema = minus({
  members: z
    .array(
      z
        .object({
          name: z.string().optional(),
          role: z.string().optional(),
          photo: z.string().optional(),
          bio: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
  columns: z.number().optional(),
  styles,
});
export const timelineSchema = minus({
  events: z
    .array(
      z
        .object({
          date: z.string().optional(),
          title: z.string().optional(),
          description: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
  styles,
});
export const gallerySchema = minus({
  images: z
    .array(z.object({ imageUrl: z.string().optional(), caption: z.string().optional() }).passthrough())
    .optional(),
  columns: z.number().optional(),
  lightbox: z.boolean().optional(),
  partStyles: z.record(z.unknown()).optional(),
  styles,
});
export const mapSchema = minus({
  address: z.string().optional(),
  embedUrl: z.string().optional(),
  height: z.number().optional(),
  styles,
});
export const footerSchema = minus({ styles });
export const footerColumnsSchema = minus({ columns: z.number().optional(), styles });

/* ---- content & composite ---------------------------------------- */
export const headingSchema = minus({
  text: z.string().optional(),
  highlightText: z.string().optional(),
  highlightColor: z.string().optional(),
  level: z.number().optional(),
  /** Animate a numeric heading from 0 → value when it scrolls into view. */
  countUp: z.boolean().optional(),
  countUpDuration: z.number().optional(),
  countUpDelay: z.number().optional(),
  countUpEasing: z.enum(["linear", "ease", "easeOut", "easeInOut"]).optional(),
  textStyles: z.record(z.unknown()).optional(),
  styles,
});

export const paragraphSchema = minus({
  text: z.string().optional(),
  highlightText: z.string().optional(),
  highlightColor: z.string().optional(),
  styles,
});

/**
 * A responsive/next-gen derivative produced by the media pipeline
 * (apps/api MEDIA-OPTIMIZATION.md). The Image block consumes these to build a
 * `srcset`/`<picture>`. Stored on the block props (not fetched at render time)
 * so the published HTML is self-contained + SSR/parity-safe.
 */
export const mediaVariantSchema = z
  .object({
    width: z.number(),
    format: z.string().optional(),
    url: z.string(),
    bytes: z.number().optional(),
    height: z.number().optional(),
  })
  .passthrough();

export const imageSchema = minus({
  imageUrl: z.string().optional(),
  altText: z.string().optional(),
  url: z.string().optional(),
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  objectFit: z.string().optional(),
  // Inline SVG markup (pasted/uploaded). When set it is rendered (sanitized via
  // `sanitizeSvg`) instead of an <img>, so a vector logo/icon stays crisp and
  // themeable. Sanitization strips scripts/handlers/external refs.
  inlineSvg: z.string().optional(),
  imageStyles: z.record(z.unknown()).optional(),
  figureClassName: z.string().optional(),
  // --- Responsive-output fields (captured from the media library at pick time) ---
  // Responsive/next-gen derivatives → `srcset` + optional <picture> sources.
  variants: z.array(mediaVariantSchema).optional(),
  // Intrinsic pixel dimensions of the source image → reserve space (no CLS).
  intrinsicWidth: z.number().optional(),
  intrinsicHeight: z.number().optional(),
  // Focal point (0–1) → object-position so smart crops stay framed.
  focalPoint: z.object({ x: z.number(), y: z.number() }).passthrough().optional(),
  // `sizes` attribute override (default "100vw"); how wide the image renders.
  sizes: z.string().optional(),
  // Loading strategy: "lazy" (default) or "eager" for above-the-fold/LCP images.
  loading: z.enum(["lazy", "eager"]).optional(),
  styles,
});

/**
 * Icon block — renders a single lucide icon by PascalCase `name` (e.g. "Camera",
 * "ArrowRight"). `color` follows the theme-token convention so it can be a raw
 * color OR `hsl(var(--primary))`. Unknown names render a safe fallback box.
 */
export const iconSchema = minus({
  name: z.string().optional().default("Sparkles"),
  size: z.number().optional().default(32),
  color: z.string().optional().default("currentColor"),
  strokeWidth: z.number().optional().default(2),
  url: z.string().optional(),
  label: z.string().optional(),
  styles,
});

/**
 * Video block — plays either (a) a direct video file URL via a native <video>,
 * or (b) a YouTube/Vimeo link rendered as a sanitized, sandboxed iframe embed
 * (reusing the Embed iframe-host allowlist). `mode: "background"` makes the
 * video cover its container (object-fit:cover, no controls) for hero backgrounds.
 * `provider` is auto-detected from the URL but may be forced.
 */
export const videoSchema = minus({
  src: z.string().optional(),
  poster: z.string().optional(),
  provider: z.enum(["auto", "file", "youtube", "vimeo"]).optional().default("auto"),
  mode: z.enum(["inline", "background"]).optional().default("inline"),
  autoplay: z.boolean().optional().default(false),
  loop: z.boolean().optional().default(false),
  muted: z.boolean().optional().default(false),
  controls: z.boolean().optional().default(true),
  styles,
});

export const buttonSchema = minus({
  label: z.string().optional(),
  url: z.string().optional(),
  variant: z
    .enum(["primary", "secondary", "ghost", "outline", "danger", "success"])
    .optional()
    .default("primary"),
  iconAfter: z.string().optional(),
  partStyles: z.record(z.unknown()).optional(),
  styles,
});

/**
 * ONSITE-SEARCH (#64) — a public site-search box. In the renderer it is a
 * "use client" island that queries the same-origin `/api/search` proxy and
 * renders ranked results; in the builder it renders a static preview.
 */
export const searchSchema = minus({
  placeholder: z.string().optional().default("Search…"),
  buttonLabel: z.string().optional().default("Search"),
  showButton: z.boolean().optional().default(true),
  styles,
});

export const sectionHeadingSchema = minus({
  subtitle: z.string().optional(),
  title: z.string().optional(),
  highlightText: z.string().optional(),
  highlightColor: z.string().optional(),
  align: z.string().optional(),
  styles,
});

export const footerLinksSchema = minus({
  title: z.string().optional(),
  links: z.array(linkItem).optional(),
  styles,
});

export const topbarSchema = minus({
  text: z.string().optional(),
  linkUrl: z.string().optional(),
  rightText: z.string().optional(),
  rightUrl: z.string().optional(),
  sticky: z.boolean().optional(),
  styles,
});

/** Shared nav link row used in dropdowns and mega columns. */
export const navMenuLinkSchema = z
  .object({ label: z.string().optional(), url: z.string().optional() })
  .passthrough();

/** Mega menu column — title + sub-links or promo CTA cell. */
export const navMegaColumnSchema = z
  .object({
    title: z.string().optional(),
    url: z.string().optional(),
    promo: z.boolean().optional(),
    links: z.array(navMenuLinkSchema).optional(),
  })
  .passthrough();

/** Recursive nav item for legacy Navbar `navItems` prop. */
export const navItemSchema: z.ZodType<{
  label?: string;
  url?: string;
  items?: unknown[];
  menuColumns?: unknown[];
}> = z.lazy(() =>
  z
    .object({
      label: z.string().optional(),
      url: z.string().optional(),
      items: z.array(navItemSchema).optional(),
      menuColumns: z.array(navMegaColumnSchema).optional(),
    })
    .passthrough(),
);

/** Default logo height (px) — matches live officebeacon.com (175×38 asset). */
export const NAVBAR_LOGO_HEIGHT_DEFAULT = 38;

/** Fill missing logo height on save/repair; do not upscale (live site uses 38px). */
export const normalizeNavbarLogoHeight = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  if (!props.logoImage || typeof props.logoImage !== "string") return props;
  const raw = props.logoImageHeight;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return { ...props, logoImageHeight: NAVBAR_LOGO_HEIGHT_DEFAULT };
  }
  return props;
};

/** Strip accidental canvas resize heights that clip the nav bar. */
export const normalizeNavbarStyles = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const styles = props.styles;
  if (!styles || typeof styles !== "object") return props;
  const s = { ...(styles as Record<string, unknown>) };
  const sizing = s.sizing;
  if (sizing && typeof sizing === "object") {
    const sz = { ...(sizing as Record<string, unknown>) };
    delete sz.height;
    delete sz.maxHeight;
    s.sizing = sz;
  }
  return { ...props, styles: s };
};

const isOfficeBeaconNavbar = (props: Record<string, unknown>): boolean => {
  const logoText = String(props.logoText ?? "");
  const logoUrl = String(props.logoUrl ?? props.logoImage ?? "");
  return /office\s*beacon/i.test(logoText) || /officebeacon/i.test(logoUrl);
};

/** Align Office Beacon navbars with live site defaults (logo, mode, layout). */
export const normalizeNavbarForLiveSite = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  let next = normalizeNavbarLogoHeight(props);
  next = normalizeNavbarStyles(next);
  if (!isOfficeBeaconNavbar(next)) return next;

  const logoImage = String(next.logoImage ?? "");
  const normalizedLogo = logoImage.includes("office-beacon/logos")
    ? "https://www.officebeacon.com/hs-fs/hubfs/office-beacon/logos/OB%20Logo%20Colour.png?width=175&height=38&name=OB%20Logo%20Colour.png"
    : logoImage;

  return {
    ...next,
    mode: "legacy",
    logoImageHeight: NAVBAR_LOGO_HEIGHT_DEFAULT,
    logoImage: normalizedLogo,
    showCta: next.showCta !== false,
    ctaText: "Get Started",
    ctaUrl: "https://www.officebeacon.com/lp/build-your-remote-team",
    ctaStyles: {
      background: "linear-gradient(90deg, #147eff, #4d9dff)",
      color: "#ffffff",
      paddingX: 16,
      paddingY: 12,
      borderRadius: 6,
    },
  };
};

export const navbarSchema = minus({
  mode: z.enum(["composed", "legacy"]).optional(),
  logoText: z.string().optional(),
  logoImage: z.string().optional(),
  logoUrl: z.string().optional(),
  logoImageHeight: z.number().optional(),
  autoLinks: z.boolean().optional(),
  useObTemplate: z.boolean().optional(),
  navItems: z.array(navItemSchema).optional(),
  links: z.array(linkItem).optional(),
  linkStyles: z.record(z.unknown()).optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  showCta: z.boolean().optional(),
  ctaStyles: z.record(z.unknown()).optional(),
  navbarBg: z.string().optional(),
  sticky: z.boolean().optional(),
  transparent: z.boolean().optional(),
  linkHoverStyles: z.record(z.unknown()).optional(),
  logoStyles: z.record(z.unknown()).optional(),
  styles,
});

export const navMenuSchema = minus({ styles });

export const navLinkItemSchema = minus({
  label: z.string().optional(),
  url: z.string().optional(),
  styles,
});

export const navDropdownSchema = minus({
  label: z.string().optional(),
  url: z.string().optional(),
  items: z.array(navMenuLinkSchema).optional(),
  styles,
});

export const navMegaSchema = minus({
  label: z.string().optional(),
  columns: z.array(navMegaColumnSchema).optional(),
  megaIndex: z.number().optional(),
  styles,
});

export const heroSectionSchema = minus({
  title: z.string().optional(),
  highlightText: z.string().optional(),
  highlightColor: z.string().optional(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  ctaStyles: z.record(z.unknown()).optional(),
  buttons: z.array(z.record(z.unknown())).optional(),
  showCta: z.boolean().optional(),
  ctaIcon: z.string().optional(),
  trustBadgeUrl: z.string().optional(),
  trustBadgeLink: z.string().optional(),
  showTrustDivider: z.boolean().optional(),
  heroImageStyles: z.record(z.unknown()).optional(),
  titleStyles: z.record(z.unknown()).optional(),
  subtitleStyles: z.record(z.unknown()).optional(),
  contentColumnStyles: z.record(z.unknown()).optional(),
  splitGridStyles: z.record(z.unknown()).optional(),
  imageUrl: z.string().optional(),
  layout: z.string().optional(),
  styles,
});

export const logoCarouselSchema = minus({
  carousel: z.boolean().optional(),
  marquee: z.boolean().optional(),
  autoplay: z.boolean().optional(),
  autoplayInterval: z.number().optional(),
  showArrows: z.boolean().optional(),
  slidesVisible: z.number().optional(),
  logos: z.array(z.union([z.string(), z.record(z.unknown())])).optional(),
  partStyles: z.record(z.unknown()).optional(),
  styles,
});

export const videoTestimonialCarouselSchema = minus({
  slidesVisible: z.number().optional(),
  showArrows: z.boolean().optional(),
  useModal: z.boolean().optional(),
  showReadMore: z.boolean().optional(),
  quoteMaxLength: z.number().optional(),
  showProgress: z.boolean().optional(),
  items: z.array(z.record(z.unknown())).optional(),
  styles,
});

export const featureListSchema = minus({
  columns: z.number().optional(),
  features: z.array(z.record(z.unknown())).optional(),
  partStyles: z.record(z.unknown()).optional(),
  styles,
});

export const counterSectionSchema = minus({
  columns: z.number().optional(),
  cardStyle: z.boolean().optional(),
  animate: z.boolean().optional(),
  animateDuration: z.number().optional(),
  stats: z.array(z.record(z.unknown())).optional(),
  partStyles: z.record(z.unknown()).optional(),
  styles,
});

export const stepCardsSchema = minus({
  columns: z.number().optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  partStyles: z.record(z.unknown()).optional(),
  styles,
});

export const contentCarouselSchema = minus({
  slidesVisible: z.number().optional(),
  showArrows: z.boolean().optional(),
  autoplay: z.boolean().optional(),
  autoplayInterval: z.number().optional(),
  slides: z.array(z.record(z.unknown())).optional(),
  styles,
});

export const articleCardGridSchema = minus({
  columns: z.number().optional(),
  layout: z.string().optional(),
  showArrows: z.boolean().optional(),
  articles: z.array(z.record(z.unknown())).optional(),
  styles,
});

export const linkSchema = minus({
  // Default text so a freshly dropped Link is visible + selectable on the canvas
  // (an empty inline link is zero-width). Fully editable afterwards.
  text: z.string().optional().default("Link"),
  url: z.string().optional(),
  linkStyles: z.record(z.unknown()).optional(),
  styles,
});

export const badgeSchema = minus({
  text: z.string().optional().default("Badge"),
  styles,
});

export const richTextSchema = minus({
  html: z.string().optional().default("<p>Start writing…</p>"),
  styles,
});

export const countdownSchema = minus({
  targetDate: z.string().optional(),
  label: z.string().optional().default("Event starts in"),
  showDays: z.boolean().optional().default(true),
  styles,
});

export const progressBarSchema = minus({
  value: z.number().optional().default(65),
  max: z.number().optional().default(100),
  label: z.string().optional().default("Progress"),
  showLabel: z.boolean().optional().default(true),
  styles,
});

export const comparisonTableSchema = minus({
  title: z.string().optional().default("Compare plans"),
  columns: z.array(z.object({ label: z.string().optional() })).optional(),
  rows: z.array(z.object({ feature: z.string().optional(), values: z.array(z.string()).optional() })).optional(),
  styles,
});

export const beforeAfterSchema = minus({
  beforeUrl: z.string().optional(),
  afterUrl: z.string().optional(),
  label: z.string().optional().default("Drag to compare"),
  styles,
});

export const masonryGallerySchema = minus({
  images: z.array(z.object({ url: z.string().optional(), alt: z.string().optional() })).optional(),
  columns: z.number().optional().default(3),
  styles,
});

export const codeBlockSchema = minus({
  code: z.string().optional().default(""),
  language: z.string().optional().default("text"),
  styles,
});

export const dataTableSchema = minus({
  headers: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).optional(),
  styles,
});

export const newsletterSignupSchema = minus({
  title: z.string().optional().default("Subscribe to our newsletter"),
  placeholder: z.string().optional().default("Your email"),
  buttonLabel: z.string().optional().default("Subscribe"),
  styles,
});

export const cookieBannerSchema = minus({
  message: z.string().optional().default("We use cookies to improve your experience."),
  acceptLabel: z.string().optional().default("Accept"),
  styles,
});

export const floatingCtaSchema = minus({
  label: z.string().optional().default("Get started"),
  url: z.string().optional().default("#"),
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional().default("bottom-right"),
  styles,
});

export const lottieSchema = minus({
  src: z.string().optional(),
  loop: z.boolean().optional().default(true),
  autoplay: z.boolean().optional().default(true),
  styles,
});

export const calendarSchema = minus({
  title: z.string().optional().default("Upcoming dates"),
  events: z.array(z.object({ date: z.string().optional(), label: z.string().optional() })).optional(),
  styles,
});

export const eventTimelineSchema = minus({
  title: z.string().optional().default("Event schedule"),
  events: z.array(z.object({ time: z.string().optional(), title: z.string().optional(), description: z.string().optional() })).optional(),
  styles,
});

export const stepperFormSchema = minus({
  title: z.string().optional().default("Multi-step form"),
  steps: z.array(z.object({ label: z.string().optional(), description: z.string().optional() })).optional(),
  styles,
});

export const designFrameSchema = minus({
  label: z.string().optional().default("Design frame"),
  note: z.string().optional(),
  styles,
});

export const pricingCalculatorSchema = minus({
  title: z.string().optional().default("Pricing calculator"),
  basePrice: z.number().optional().default(29),
  perUserPrice: z.number().optional().default(5),
  styles,
});

export const socialFeedSchema = minus({
  title: z.string().optional().default("Social feed"),
  handle: z.string().optional().default("@yourbrand"),
  embedUrl: z.string().optional(),
  styles,
});

export const socialIconsSchema = minus({
  links: z.array(z.record(z.unknown())).optional(),
  styles,
});

export const dividerSchema = minus({
  color: z.string().optional(),
  thickness: z.number().optional(),
  styles,
});

export const copyrightBlockSchema = minus({
  text: z.string().optional(),
  styles,
});

export const formSchema = minus({
  formId: z.string().optional(),
  submitLabel: z.string().optional().default("Submit"),
  styles,
});

/**
 * Reusable / global synced block reference. `reusableBlockId` points at a stored
 * `reusable_blocks` row (per site); the block resolves that row's SerializedLayout
 * at render time so editing the source updates EVERY instance ("edit once, update
 * everywhere"). Distinct from one-time template COPIES.
 */
export const reusableBlockSchema = minus({
  reusableBlockId: z.string().optional(),
  // COMPONENTS: a ReusableBlock is now a component INSTANCE. These per-instance
  // fields are all optional + absent for a plain reference, so existing instances
  // (id only) round-trip byte-identically and resolve exactly as before.
  /** Selected variant name (a named prop-preset on the source component). */
  variant: z.string().optional(),
  /** Per-instance prop overrides: `{ [componentPropKey]: value }`. */
  propOverrides: z.record(z.unknown()).optional(),
  /** Per-slot replacement content: `{ [slotName]: SerializedLayout subtree }`. */
  slotContent: z.record(z.unknown()).optional(),
  styles,
});

/**
 * Collection List — a dynamic, data-resolving block (HubDB / WP-CPT list).
 * `collectionSlug` selects a per-site collection; the block resolves its
 * published items at render time and lays them out as a responsive grid of
 * cards. `cardFields` maps field keys to [image, title, excerpt]; `linkPattern`
 * builds each card's href (`:slug` → the item slug).
 */
export const collectionListSchema = minus({
  collectionSlug: z.string().optional(),
  limit: z.number().optional().default(9),
  columns: z.number().optional().default(3),
  sort: z.string().optional(),
  cardFields: z.array(z.string()).optional(),
  linkPattern: z.string().optional(),
  styles,
});

/**
 * Repeater — a dynamic, CANVAS block (has children) that loops an arbitrary
 * block-tree template over a collection. It carries the SAME data-resolving
 * props as Collection List (`collectionSlug`/`limit`/`sort`/`filter`) but,
 * instead of a fixed card grid, it renders its single template subtree once per
 * resolved item with that item's data available to descendants via
 * `RepeaterItemContext` (so any descendant prop can be bound to a field).
 *
 *  - EDITOR: the template renders ONCE (authoring instance) with a sample/first
 *    item; a "repeats × N" affordance hints at the published count.
 *  - RENDERER: the template renders once per published item.
 *
 * `filter` is a documented seam (reserved for field predicates); `sort` mirrors
 * the Collection List sort string.
 */
export const repeaterSchema = minus({
  collectionSlug: z.string().optional(),
  limit: z.number().optional().default(12),
  sort: z.string().optional(),
  filter: z.string().optional(),
  styles,
});

/**
 * Experiment — a Phase 4 A/B-testing CANVAS block. Each direct child subtree is
 * one authored variant; the renderer renders ONLY the variant the visitor is
 * assigned (deterministic sticky split by `hash(visitorId + experimentId)`) and
 * fires an exposure beacon. The variant↔child mapping + attached experiment id
 * live on the node's top-level `experiment` field (see layout.ts); the props
 * here are just presentational (styles).
 */
export const experimentSchema = minus({
  styles,
});

/**
 * Embed / custom-HTML block (Gap A8). Lets marketers paste third-party embed
 * code (YouTube/Vimeo iframes, Calendly, HubSpot forms, Google Maps, custom
 * HTML). The `html` string is sanitized via `sanitizeEmbedHtml` at render time
 * (allow-listed iframes + safe formatting tags only) — it is NEVER rendered raw.
 */
export const embedSchema = minus({
  html: z.string().optional().default(""),
  styles,
});

/**
 * The block prop-schema registry. Keys are the Craft.js `resolvedName`s used in
 * the OB export. MUST stay in lockstep with the React `blockRegistry` in
 * @ob-cms/blocks.
 */
export const blockPropSchemas: Record<string, z.ZodTypeAny> = {
  // canvas primitives
  Section: sectionSchema,
  Container: containerSchema,
  Row: rowSchema,
  Column: columnSchema,
  Grid: gridSchema,
  Slider: sliderSchema,
  Spacer: spacerSchema,
  Card: cardSchema,
  Group: groupSchema,
  Div: divSchema,
  Tabs: tabsSchema,
  Accordion: accordionSchema,
  Modal: modalSchema,
  "Pricing Table": pricingTableSchema,
  "Team Grid": teamGridSchema,
  Timeline: timelineSchema,
  Gallery: gallerySchema,
  Map: mapSchema,
  Footer: footerSchema,
  "Footer Columns": footerColumnsSchema,
  // content & composite
  "Hero Section": heroSectionSchema,
  Navbar: navbarSchema,
  Topbar: topbarSchema,
  NavMenu: navMenuSchema,
  "Nav Link": navLinkItemSchema,
  "Nav Dropdown": navDropdownSchema,
  "Nav Mega": navMegaSchema,
  Heading: headingSchema,
  Paragraph: paragraphSchema,
  Image: imageSchema,
  Button: buttonSchema,
  "Section Heading": sectionHeadingSchema,
  "Feature List": featureListSchema,
  "Counter Section": counterSectionSchema,
  "Step Cards": stepCardsSchema,
  "Logo Carousel": logoCarouselSchema,
  "Video Testimonial Carousel": videoTestimonialCarouselSchema,
  "Content Carousel": contentCarouselSchema,
  "Article Card Grid": articleCardGridSchema,
  "Footer Links": footerLinksSchema,
  "Social Icons": socialIconsSchema,
  Link: linkSchema,
  Badge: badgeSchema,
  "Rich Text": richTextSchema,
  Countdown: countdownSchema,
  "Progress Bar": progressBarSchema,
  "Comparison Table": comparisonTableSchema,
  "Before / After": beforeAfterSchema,
  "Masonry Gallery": masonryGallerySchema,
  "Code Block": codeBlockSchema,
  Table: dataTableSchema,
  Newsletter: newsletterSignupSchema,
  "Cookie Banner": cookieBannerSchema,
  "Floating CTA": floatingCtaSchema,
  Lottie: lottieSchema,
  Calendar: calendarSchema,
  "Event Timeline": eventTimelineSchema,
  "Stepper Form": stepperFormSchema,
  "Design Frame": designFrameSchema,
  "Pricing Calculator": pricingCalculatorSchema,
  "Social Feed": socialFeedSchema,
  Divider: dividerSchema,
  "Copyright Block": copyrightBlockSchema,
  Form: formSchema,
  "Reusable Block": reusableBlockSchema,
  "Collection List": collectionListSchema,
  Repeater: repeaterSchema,
  Experiment: experimentSchema,
  Embed: embedSchema,
  Icon: iconSchema,
  Video: videoSchema,
  Search: searchSchema,
};

export type BlockType = keyof typeof blockPropSchemas;

/** All supported block type names. */
export const BLOCK_TYPES = Object.keys(blockPropSchemas);

/** Validate (and fill defaults for) a block's props against its schema. */
export const validateBlockProps = (
  type: string,
  props: unknown,
):
  | { ok: true; props: Record<string, unknown> }
  | { ok: false; error: string } => {
  const schema = blockPropSchemas[type];
  if (!schema) return { ok: false, error: `Unknown block type: ${type}` };
  const parsed = schema.safeParse(props ?? {});
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  return { ok: true, props: parsed.data as Record<string, unknown> };
};
