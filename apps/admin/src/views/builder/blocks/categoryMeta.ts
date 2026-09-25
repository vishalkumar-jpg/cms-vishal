import type { BlockCategory } from "./categories";

/** Plain-English descriptions shown under each palette category heading. */
export const CATEGORY_META: Record<BlockCategory, { description: string }> = {
  Layout: {
    description: "Structure the page — sections, rows, columns, and grids.",
  },
  Content: {
    description: "Text, buttons, images, and everyday page elements.",
  },
  Navigation: {
    description: "Menus and announcement bars visitors see first.",
  },
  Media: {
    description: "Videos, carousels, and visual showcases.",
  },
  Marketing: {
    description: "Heroes, features, stats, and conversion sections.",
  },
  Forms: {
    description: "Collect leads and help visitors search your site.",
  },
  Dynamic: {
    description: "Lists that pull from your content or repeat a pattern.",
  },
  Footer: {
    description: "Links, social icons, and copyright for the page bottom.",
  },
};
