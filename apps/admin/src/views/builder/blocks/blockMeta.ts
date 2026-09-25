/**
 * Human-friendly metadata for every palette block. This powers the "Show
 * descriptions" mode and the palette's keyword search so non-technical users
 * understand what each block is for, when to use it, and where it belongs on a
 * page — without needing web-development knowledge.
 *
 * Keyed by the registry `resolvedName` (must match `BLOCK_CATEGORIES`). Blocks
 * without an explicit entry fall back to `metaFor()`'s generated default.
 */
export interface BlockMeta {
  /** Friendly display name (defaults to registry name when omitted). */
  label?: string;
  /** One-line "what it does" shown under the block name. */
  summary: string;
  /** When / why a user would reach for this block. */
  whenToUse?: string;
  /** Where it typically belongs on a page. */
  placement?: string;
  /** Extra search terms (users rarely know the exact block name). */
  keywords?: string[];
}

export const BLOCK_META: Record<string, BlockMeta> = {
  /* ---- Layout ---------------------------------------------------------- */
  Section: {
    summary: "A full-width band that groups related content.",
    whenToUse: "Use one Section per distinct part of the page (hero, features, pricing…).",
    placement: "The main building block — stack Sections top to bottom.",
    keywords: ["band", "block", "wrapper", "group", "region"],
  },
  Container: {
    summary: "Centers content and keeps it from stretching too wide.",
    whenToUse: "Put your content inside a Container so it stays readable on large screens.",
    keywords: ["wrapper", "center", "max width", "inner"],
  },
  Row: {
    label: "Horizontal row",
    summary: "Places items side by side, left to right.",
    whenToUse: "Use for horizontal groups like a logo next to a menu.",
    keywords: ["columns", "horizontal", "flex", "side by side"],
  },
  Column: {
    label: "Vertical column",
    summary: "A vertical stack of items inside a Row.",
    whenToUse: "Split a Row into columns for multi-column layouts.",
    keywords: ["vertical", "stack", "grid cell"],
  },
  Grid: {
    summary: "Arranges items in an even grid of rows and columns.",
    whenToUse: "Great for card layouts, galleries and feature tiles.",
    keywords: ["cards", "gallery", "tiles", "layout"],
  },
  Div: {
    label: "Box",
    summary: "A blank box you can style and fill with anything.",
    whenToUse: "Use when no other layout block fits — a flexible container.",
    keywords: ["box", "block", "container", "wrapper"],
  },
  Card: {
    summary: "A padded, rounded box with a subtle shadow.",
    whenToUse: "Wrap a feature, price or profile so it looks like a tidy card.",
    keywords: ["card", "box", "panel", "tile", "shadow"],
  },
  Group: {
    summary: "Puts a few items together and lines them up.",
    whenToUse: "Group a label with a button, or icons in a row, and align them.",
    keywords: ["group", "wrapper", "flex", "align", "cluster"],
  },
  Spacer: {
    summary: "Adds empty vertical space between blocks.",
    whenToUse: "Create breathing room without fiddling with spacing settings.",
    keywords: ["space", "gap", "margin", "padding", "blank", "whitespace"],
  },
  Divider: {
    summary: "A thin line that separates content.",
    whenToUse: "Add breathing room between two sections or ideas.",
    keywords: ["line", "separator", "hr", "rule", "spacer"],
  },
  Slider: {
    summary: "A swipeable row of slides with next/back arrows.",
    whenToUse: "Show several cards, images or videos in a small space — drop any blocks inside as slides.",
    placement: "Great for testimonials, article/blog cards, logos or galleries.",
    keywords: ["carousel", "slider", "swipe", "scroller", "slideshow", "cards", "gallery"],
  },

  /* ---- Content --------------------------------------------------------- */
  Heading: {
    summary: "A title or headline.",
    whenToUse: "Introduce a section or grab attention with big text.",
    keywords: ["title", "headline", "h1", "h2", "text"],
  },
  Paragraph: {
    summary: "A block of body text.",
    whenToUse: "Explain something in a sentence or two.",
    keywords: ["text", "body", "copy", "description"],
  },
  "Rich Text": {
    summary: "Formatted text with headings, lists, links, and styles.",
    whenToUse: "Long-form content, blog excerpts, or styled copy beyond a plain paragraph.",
    keywords: ["wysiwyg", "html", "editor", "article", "formatted"],
  },
  "Section Heading": {
    summary: "A styled title + subtitle pair to open a section.",
    whenToUse: "Introduce a features or pricing section with a heading and short intro.",
    keywords: ["title", "subtitle", "intro", "header"],
  },
  Button: {
    summary: "A clickable action, like “Get started”.",
    whenToUse: "Guide visitors to the next step (sign up, buy, contact).",
    keywords: ["cta", "action", "link", "click"],
  },
  Link: {
    summary: "Clickable text that goes to another page.",
    whenToUse: "Link to more info without a big button.",
    keywords: ["anchor", "url", "hyperlink", "text link"],
  },
  Badge: {
    label: "Badge / Chip",
    summary: "A small pill label — great for tags, status, or trust markers.",
    whenToUse: "Highlight a feature, category, or “New” label without a full button.",
    keywords: ["chip", "tag", "pill", "label", "trust", "banner"],
  },
  Image: {
    summary: "A picture or photo.",
    whenToUse: "Show a product, screenshot, team photo or illustration.",
    keywords: ["photo", "picture", "img", "graphic", "media"],
  },
  Icon: {
    summary: "A small symbol, like a checkmark or star.",
    whenToUse: "Add visual cues next to features or list items.",
    keywords: ["symbol", "glyph", "svg", "bullet"],
  },
  Tabs: {
    summary: "Switch between panels of content with tabs.",
    whenToUse: "Fit lots of content in one spot — visitors click a tab to reveal each.",
    keywords: ["tabs", "panels", "switch", "sections"],
  },
  Accordion: {
    label: "Accordion / FAQ",
    summary: "Expandable questions that open to reveal answers.",
    whenToUse: "Perfect for FAQs — keeps the page short until a visitor clicks.",
    keywords: ["faq", "accordion", "expand", "collapse", "questions", "toggle"],
  },
  Embed: {
    label: "Custom embed",
    summary: "Drops in outside content via a code snippet.",
    whenToUse: "Add a map, calendar or third-party widget.",
    keywords: ["iframe", "html", "code", "widget", "external"],
  },

  /* ---- Navigation ------------------------------------------------------ */
  Navbar: {
    label: "Site menu",
    summary: "Top navigation bar — drop logo, menu items, and CTA as child blocks.",
    whenToUse: "Help visitors move around your site. Use composed mode to edit every link, dropdown, and mega menu as separate blocks.",
    placement: "Usually the very first block on every page.",
    keywords: ["menu", "header", "nav", "navigation", "links", "mega", "dropdown"],
  },
  NavMenu: {
    label: "Nav menu list",
    summary: "Horizontal menu container for nav links, dropdowns, and mega menus.",
    whenToUse: "Place inside a Navbar. Drop Nav Link, Nav Dropdown, or Nav Mega blocks inside.",
    placement: "Inside Navbar, between logo and CTA.",
    keywords: ["menu", "nav", "links"],
  },
  "Nav Link": {
    label: "Nav link",
    summary: "A single top-level navigation link.",
    whenToUse: "Simple menu items like Home, Contact, Careers.",
    placement: "Inside Nav Menu.",
    keywords: ["link", "nav", "menu"],
  },
  "Nav Dropdown": {
    label: "Nav dropdown",
    summary: "A menu item that opens a dropdown list of sub-links.",
    whenToUse: "Group related pages under one label (e.g. Solutions).",
    placement: "Inside Nav Menu.",
    keywords: ["dropdown", "submenu", "nav"],
  },
  "Nav Mega": {
    label: "Nav mega menu",
    summary: "A menu item that opens a full-width multi-column mega panel.",
    whenToUse: "Large menus with grouped sub-links (e.g. Staffing Services).",
    placement: "Inside Nav Menu.",
    keywords: ["mega", "megamenu", "columns", "nav"],
  },
  Topbar: {
    label: "Announcement bar",
    summary: "A slim strip above the navbar for announcements.",
    whenToUse: "Promote a sale, notice or contact info.",
    placement: "Above the Navbar.",
    keywords: ["announcement", "banner", "notice", "strip"],
  },

  /* ---- Media ----------------------------------------------------------- */
  Video: {
    summary: "An embedded video player.",
    whenToUse: "Show a demo, intro or explainer video.",
    keywords: ["youtube", "vimeo", "player", "media", "film"],
  },
  Gallery: {
    summary: "A grid of images that open full-size on click.",
    whenToUse: "Showcase photos, screenshots or a portfolio.",
    keywords: ["gallery", "photos", "images", "grid", "lightbox", "portfolio"],
  },
  Map: {
    summary: "Shows a location on a map from an address.",
    whenToUse: "Help visitors find your office or store — just type the address.",
    keywords: ["map", "location", "google maps", "address", "directions"],
  },
  "Logo Carousel": {
    summary: "A sliding row of customer or partner logos.",
    whenToUse: "Build trust by showing who uses you (“As seen in…”).",
    placement: "Often just under the hero.",
    keywords: ["logos", "brands", "slider", "trust", "partners"],
  },
  "Content Carousel": {
    summary: "A swipeable slideshow of cards or images.",
    whenToUse: "Show several items in a small space.",
    keywords: ["slider", "slideshow", "swipe", "cards", "gallery"],
  },
  "Video Testimonial Carousel": {
    summary: "A slideshow of customer video testimonials.",
    whenToUse: "Let happy customers tell your story on camera.",
    keywords: ["reviews", "testimonials", "video", "slider", "social proof"],
  },
  "Article Card Grid": {
    summary: "A grid of article or blog preview cards.",
    whenToUse: "Show recent posts or resources.",
    keywords: ["blog", "posts", "cards", "articles", "news"],
  },

  /* ---- Marketing ------------------------------------------------------- */
  "Hero Section": {
    summary: "The big introductory banner at the top of a page.",
    whenToUse: "Make a strong first impression with a headline and call-to-action.",
    placement: "Best used once, at the very top (after the navbar).",
    keywords: ["banner", "intro", "header", "cta", "landing", "top"],
  },
  "Feature List": {
    summary: "A grid highlighting your key features or benefits.",
    whenToUse: "Explain what you offer in scannable chunks.",
    placement: "Usually right after the hero.",
    keywords: ["features", "benefits", "grid", "cards", "highlights"],
  },
  "Counter Section": {
    summary: "Eye-catching stats, like “4,000+ customers”.",
    whenToUse: "Prove impact with numbers.",
    keywords: ["stats", "numbers", "metrics", "counter", "figures"],
  },
  "Step Cards": {
    summary: "A numbered “how it works” sequence.",
    whenToUse: "Walk visitors through a process in steps.",
    keywords: ["how it works", "steps", "process", "guide", "onboarding"],
  },
  "Pricing Table": {
    summary: "Side-by-side plans with prices and features.",
    whenToUse: "Show your pricing tiers and highlight the best value.",
    placement: "A dedicated pricing section.",
    keywords: ["pricing", "plans", "tiers", "cost", "subscription", "packages"],
  },
  "Team Grid": {
    summary: "A grid of team members with photos and roles.",
    whenToUse: "Introduce the people behind your company.",
    keywords: ["team", "people", "staff", "members", "about", "profiles"],
  },
  Timeline: {
    summary: "A vertical sequence of dated events.",
    whenToUse: "Show company history, a roadmap or a process over time.",
    keywords: ["timeline", "history", "roadmap", "milestones", "events", "steps"],
  },
  Modal: {
    label: "Popup / Modal",
    summary: "A button that opens a popup with any content inside.",
    whenToUse: "Show a sign-up form, video or notice without leaving the page.",
    keywords: ["modal", "popup", "dialog", "overlay", "lightbox"],
  },
  Countdown: {
    summary: "A live countdown to a date or event.",
    whenToUse: "Build urgency for launches, sales, or webinars.",
    keywords: ["timer", "clock", "deadline", "event"],
  },
  "Progress Bar": {
    summary: "A visual bar showing completion or progress.",
    whenToUse: "Skills, project status, fundraising goals, or loading states.",
    keywords: ["meter", "bar", "percent", "completion"],
  },
  "Comparison Table": {
    summary: "Side-by-side feature comparison for plans or products.",
    whenToUse: "Pricing pages, plan choosers, or competitive comparisons.",
    keywords: ["compare", "features", "plans", "pricing", "table"],
  },
  "Before / After": {
    summary: "Interactive slider comparing two images.",
    whenToUse: "Show transformations, redesigns, or product results.",
    keywords: ["slider", "compare", "images", "transformation"],
  },
  "Masonry Gallery": {
    summary: "A Pinterest-style image gallery in columns.",
    whenToUse: "Portfolios, photo collections, or uneven image grids.",
    keywords: ["gallery", "photos", "masonry", "portfolio"],
  },
  "Code Block": {
    summary: "Formatted code snippet for docs or tutorials.",
    whenToUse: "Developer content, API examples, or technical guides.",
    keywords: ["code", "snippet", "pre", "developer"],
  },
  Table: {
    label: "Data table",
    summary: "Rows and columns of structured data.",
    whenToUse: "Specs, schedules, or any tabular information.",
    keywords: ["table", "data", "grid", "rows"],
  },
  Newsletter: {
    summary: "Email signup form for your mailing list.",
    whenToUse: "Capture subscribers in footers, popups, or landing pages.",
    keywords: ["email", "subscribe", "signup", "mailing"],
  },
  "Cookie Banner": {
    summary: "Consent notice for cookies and privacy.",
    whenToUse: "GDPR/privacy compliance on first visit.",
    keywords: ["cookies", "consent", "privacy", "gdpr"],
  },
  "Floating CTA": {
    summary: "A sticky button that stays visible while scrolling.",
    whenToUse: "Persistent sign-up, contact, or purchase prompts.",
    keywords: ["sticky", "button", "cta", "floating"],
  },
  Lottie: {
    summary: "Embedded Lottie animation.",
    whenToUse: "Playful motion graphics, loaders, or brand animations.",
    keywords: ["animation", "lottie", "motion", "embed"],
  },
  Calendar: {
    summary: "List of upcoming dates and events.",
    whenToUse: "Workshops, launches, or scheduled milestones.",
    keywords: ["dates", "events", "schedule", "calendar"],
  },
  "Event Timeline": {
    summary: "Chronological schedule with times and descriptions.",
    whenToUse: "Conferences, agendas, or day-of-event programs.",
    keywords: ["agenda", "schedule", "timeline", "events"],
  },
  "Stepper Form": {
    summary: "Multi-step form wizard.",
    whenToUse: "Long forms split into easy steps (checkout, onboarding).",
    keywords: ["wizard", "steps", "form", "multi-step"],
  },
  "Design Frame": {
    summary: "A labeled frame for grouping design elements.",
    whenToUse: "Wireframes, mockups, or annotated layout regions.",
    keywords: ["frame", "wireframe", "mockup", "container"],
  },
  "Pricing Calculator": {
    summary: "Interactive price estimator based on options.",
    whenToUse: "SaaS pricing pages with variable team size or usage.",
    keywords: ["calculator", "pricing", "estimate", "interactive"],
  },
  "Social Feed": {
    summary: "Embedded social media feed.",
    whenToUse: "Show Instagram or other social posts on your site.",
    keywords: ["instagram", "social", "feed", "embed"],
  },

  /* ---- Forms ----------------------------------------------------------- */
  Form: {
    summary: "Collects info from visitors (name, email, message…).",
    whenToUse: "Capture leads, sign-ups or contact requests.",
    placement: "Contact sections or near the bottom of the page.",
    keywords: ["contact", "signup", "input", "lead", "fields", "submit"],
  },
  Search: {
    summary: "A search box for finding content.",
    whenToUse: "Let visitors quickly find what they need.",
    keywords: ["find", "input", "lookup", "query"],
  },

  /* ---- Dynamic --------------------------------------------------------- */
  "Collection List": {
    label: "Dynamic list",
    summary: "Automatically lists items from your content (e.g. blog posts).",
    whenToUse: "Show data-driven content that updates itself.",
    keywords: ["dynamic", "cms", "list", "data", "posts", "items"],
  },
  Repeater: {
    label: "Repeating list",
    summary: "Repeats a design once for each item in a collection.",
    whenToUse: "Design one card and reuse it for every entry.",
    keywords: ["dynamic", "loop", "template", "cms", "items"],
  },
  Experiment: {
    label: "A/B test",
    summary: "Shows different versions to different visitors (A/B test).",
    whenToUse: "Test which design converts better.",
    keywords: ["ab test", "variant", "split", "optimize", "test"],
  },

  /* ---- Footer ---------------------------------------------------------- */
  Footer: {
    summary: "The bottom section of every page.",
    whenToUse: "Hold navigation, contact info and legal links.",
    placement: "The last block on the page.",
    keywords: ["bottom", "links", "contact", "legal"],
  },
  "Footer Columns": {
    summary: "A multi-column layout for footer links.",
    whenToUse: "Organize many footer links into tidy groups.",
    placement: "Inside the Footer.",
    keywords: ["links", "columns", "sitemap", "bottom"],
  },
  "Footer Links": {
    summary: "A titled list of links for the footer.",
    whenToUse: "Group related links (Product, Company, Support…).",
    keywords: ["links", "menu", "list", "sitemap"],
  },
  "Social Icons": {
    summary: "Row of icons linking to your social profiles.",
    whenToUse: "Connect visitors to your socials.",
    keywords: ["social", "icons", "facebook", "twitter", "instagram", "linkedin"],
  },
  "Copyright Block": {
    summary: "The small “© 2025 Company” legal line.",
    whenToUse: "Show copyright and fine print.",
    placement: "The very bottom of the footer.",
    keywords: ["copyright", "legal", "©", "rights", "year"],
  },
};

/** Meta for a block, with a sensible generated fallback for unknown names. */
export const metaFor = (name: string): BlockMeta =>
  BLOCK_META[name] ?? {
    summary: `Add a ${name} to your page.`,
    keywords: [name.toLowerCase()],
  };

/** User-facing block name in the palette (non-technical when possible). */
export const labelFor = (name: string): string => metaFor(name).label ?? name;
