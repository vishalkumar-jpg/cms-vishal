/**
 * Palette grouping of the 28 registry blocks. Keys are the registry
 * `resolvedName`s (must match @ob-cms/blocks `blockRegistry`). Order defines the
 * palette display order within each group.
 */
export type BlockCategory =
  | "Layout"
  | "Content"
  | "Navigation"
  | "Media"
  | "Marketing"
  | "Forms"
  | "Dynamic"
  | "Footer";

export const BLOCK_CATEGORIES: Record<BlockCategory, string[]> = {
  Layout: ["Section", "Container", "Row", "Column", "Grid", "Slider", "Card", "Group", "Spacer", "Div", "Divider"],
  Content: ["Heading", "Paragraph", "Rich Text", "Section Heading", "Button", "Link", "Badge", "Image", "Icon", "Tabs", "Accordion", "Embed", "Code Block", "Table"],
  Navigation: ["Navbar", "Topbar", "NavMenu", "Nav Link", "Nav Dropdown", "Nav Mega"],
  Media: [
    "Video",
    "Gallery",
    "Masonry Gallery",
    "Map",
    "Logo Carousel",
    "Content Carousel",
    "Video Testimonial Carousel",
    "Article Card Grid",
    "Before / After",
    "Lottie",
    "Social Feed",
  ],
  Marketing: [
    "Hero Section",
    "Feature List",
    "Counter Section",
    "Step Cards",
    "Pricing Table",
    "Comparison Table",
    "Pricing Calculator",
    "Team Grid",
    "Timeline",
    "Event Timeline",
    "Modal",
    "Countdown",
    "Progress Bar",
    "Newsletter",
    "Cookie Banner",
    "Floating CTA",
    "Calendar",
    "Stepper Form",
    "Design Frame",
  ],
  Forms: ["Form", "Search"],
  Dynamic: ["Collection List", "Repeater", "Experiment"],
  Footer: ["Footer", "Footer Columns", "Footer Links", "Social Icons", "Copyright Block"],
};

export const CATEGORY_ORDER: BlockCategory[] = [
  "Layout",
  "Content",
  "Navigation",
  "Media",
  "Marketing",
  "Forms",
  "Dynamic",
  "Footer",
];
