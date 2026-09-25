#!/usr/bin/env node
/**
 * Generates catalog preview SVGs (thumb + cover) for builtin starter templates.
 * Run: node scripts/generate-template-preview-svgs.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../apps/admin/public/templates/previews");

const BRAND = "#2563eb";
const BRAND_LIGHT = "#dbeafe";
const MUTED = "#f4f4f5";
const FG = "#18181b";
const MUTED_FG = "#71717a";
const CARD = "#ffffff";
const BORDER = "#e4e4e7";

/** @typedef {{ bands: Array<{ y: number; h: number; fill: string; kind?: string }>; title: string }} LayoutSpec */

/** @type {Record<string, LayoutSpec>} */
const LAYOUTS = {
  "tpl-blank": {
    title: "Blank Page",
    bands: [{ y: 120, h: 80, fill: MUTED, kind: "prose" }],
  },
  "tpl-saas-landing": {
    title: "SaaS Landing",
    bands: [
      { y: 0, h: 140, fill: BRAND_LIGHT, kind: "hero" },
      { y: 140, h: 90, fill: CARD, kind: "features" },
      { y: 230, h: 50, fill: MUTED, kind: "logos" },
      { y: 280, h: 55, fill: CARD, kind: "quote" },
      { y: 335, h: 45, fill: MUTED, kind: "pricing" },
    ],
  },
  "tpl-marketing-hero": {
    title: "Marketing Hero",
    bands: [
      { y: 0, h: 130, fill: BRAND_LIGHT, kind: "split-hero" },
      { y: 130, h: 55, fill: CARD, kind: "stats" },
      { y: 185, h: 70, fill: MUTED, kind: "content" },
      { y: 255, h: 70, fill: CARD, kind: "features" },
      { y: 325, h: 55, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-portfolio": {
    title: "Portfolio",
    bands: [
      { y: 0, h: 110, fill: BRAND_LIGHT, kind: "hero" },
      { y: 110, h: 130, fill: CARD, kind: "gallery" },
      { y: 240, h: 60, fill: MUTED, kind: "quote" },
      { y: 300, h: 80, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-contact": {
    title: "Contact",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 90, fill: CARD, kind: "split" },
      { y: 190, h: 110, fill: MUTED, kind: "form" },
      { y: 300, h: 80, fill: CARD, kind: "faq" },
    ],
  },
  "tpl-about": {
    title: "About",
    bands: [
      { y: 0, h: 110, fill: BRAND_LIGHT, kind: "hero" },
      { y: 110, h: 60, fill: CARD, kind: "prose" },
      { y: 170, h: 50, fill: MUTED, kind: "stats" },
      { y: 220, h: 90, fill: CARD, kind: "team" },
      { y: 310, h: 70, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-landing": {
    title: "Landing Page",
    bands: [
      { y: 0, h: 120, fill: BRAND_LIGHT, kind: "hero-form" },
      { y: 120, h: 45, fill: CARD, kind: "logos" },
      { y: 165, h: 90, fill: MUTED, kind: "faq" },
      { y: 255, h: 125, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-thank-you": {
    title: "Thank You",
    bands: [
      { y: 60, h: 120, fill: CARD, kind: "confirm" },
      { y: 180, h: 80, fill: MUTED, kind: "steps" },
      { y: 260, h: 120, fill: CARD, kind: "actions" },
    ],
  },
  "tpl-404": {
    title: "404",
    bands: [
      { y: 50, h: 100, fill: CARD, kind: "error" },
      { y: 150, h: 70, fill: MUTED, kind: "links" },
      { y: 220, h: 160, fill: CARD, kind: "home" },
    ],
  },
  "tpl-privacy-policy": {
    title: "Privacy Policy",
    bands: [
      { y: 0, h: 70, fill: CARD, kind: "prose" },
      { y: 70, h: 55, fill: MUTED, kind: "prose" },
      { y: 125, h: 55, fill: CARD, kind: "prose" },
      { y: 180, h: 55, fill: MUTED, kind: "prose" },
      { y: 235, h: 145, fill: CARD, kind: "prose" },
    ],
  },
  "tpl-generic-content": {
    title: "Content Page",
    bands: [
      { y: 0, h: 90, fill: CARD, kind: "prose" },
      { y: 90, h: 80, fill: MUTED, kind: "image" },
      { y: 170, h: 70, fill: CARD, kind: "prose" },
      { y: 240, h: 140, fill: MUTED, kind: "related" },
    ],
  },
  "tpl-homepage": {
    title: "Homepage",
    bands: [
      { y: 0, h: 110, fill: BRAND_LIGHT, kind: "hero" },
      { y: 110, h: 60, fill: CARD, kind: "features" },
      { y: 170, h: 30, fill: MUTED, kind: "logos" },
      { y: 200, h: 35, fill: CARD, kind: "stats" },
      { y: 235, h: 35, fill: MUTED, kind: "quote" },
      { y: 270, h: 65, fill: CARD, kind: "gallery" },
      { y: 335, h: 45, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-services": {
    title: "Services",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 110, fill: CARD, kind: "gallery" },
      { y: 210, h: 90, fill: MUTED, kind: "features" },
      { y: 300, h: 80, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-pricing": {
    title: "Pricing",
    bands: [
      { y: 0, h: 90, fill: BRAND_LIGHT, kind: "hero" },
      { y: 90, h: 110, fill: CARD, kind: "pricing" },
      { y: 200, h: 100, fill: MUTED, kind: "faq" },
      { y: 300, h: 80, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-team": {
    title: "Team",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 55, fill: CARD, kind: "prose" },
      { y: 155, h: 110, fill: MUTED, kind: "team" },
      { y: 265, h: 115, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-faq": {
    title: "FAQ",
    bands: [
      { y: 0, h: 90, fill: BRAND_LIGHT, kind: "hero" },
      { y: 90, h: 180, fill: MUTED, kind: "faq" },
      { y: 270, h: 110, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-blog-listing": {
    title: "Blog Home",
    bands: [
      { y: 0, h: 70, fill: CARD, kind: "prose" },
      { y: 70, h: 130, fill: MUTED, kind: "blog" },
      { y: 200, h: 180, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-terms": {
    title: "Terms & Conditions",
    bands: [
      { y: 0, h: 70, fill: CARD, kind: "prose" },
      { y: 70, h: 55, fill: MUTED, kind: "prose" },
      { y: 125, h: 55, fill: CARD, kind: "prose" },
      { y: 180, h: 55, fill: MUTED, kind: "prose" },
      { y: 235, h: 145, fill: CARD, kind: "prose" },
    ],
  },
  "tpl-service-detail": {
    title: "Service Detail",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 80, fill: CARD, kind: "features" },
      { y: 180, h: 55, fill: MUTED, kind: "prose" },
      { y: 235, h: 90, fill: CARD, kind: "gallery" },
      { y: 325, h: 55, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-industry-detail": {
    title: "Industry Detail",
    bands: [
      { y: 0, h: 110, fill: BRAND_LIGHT, kind: "split-hero" },
      { y: 110, h: 50, fill: CARD, kind: "stats" },
      { y: 160, h: 80, fill: MUTED, kind: "features" },
      { y: 240, h: 55, fill: CARD, kind: "quote" },
      { y: 295, h: 85, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-careers": {
    title: "Careers",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 55, fill: CARD, kind: "prose" },
      { y: 155, h: 90, fill: MUTED, kind: "gallery" },
      { y: 245, h: 80, fill: CARD, kind: "team" },
      { y: 325, h: 55, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-features": {
    title: "Features",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 90, fill: CARD, kind: "features" },
      { y: 190, h: 90, fill: MUTED, kind: "split-hero" },
      { y: 280, h: 100, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-testimonials": {
    title: "Testimonials",
    bands: [
      { y: 0, h: 90, fill: BRAND_LIGHT, kind: "hero" },
      { y: 90, h: 70, fill: CARD, kind: "quote" },
      { y: 160, h: 80, fill: MUTED, kind: "features" },
      { y: 240, h: 45, fill: CARD, kind: "logos" },
      { y: 285, h: 95, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-product-landing": {
    title: "Product Landing",
    bands: [
      { y: 0, h: 120, fill: BRAND_LIGHT, kind: "split-hero" },
      { y: 120, h: 70, fill: CARD, kind: "features" },
      { y: 190, h: 45, fill: MUTED, kind: "quote" },
      { y: 235, h: 70, fill: CARD, kind: "pricing" },
      { y: 305, h: 75, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-case-study": {
    title: "Case Study",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 55, fill: CARD, kind: "prose" },
      { y: 155, h: 55, fill: MUTED, kind: "prose" },
      { y: 210, h: 45, fill: CARD, kind: "stats" },
      { y: 255, h: 70, fill: MUTED, kind: "gallery" },
      { y: 325, h: 55, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-blog-detail": {
    title: "Blog Post",
    bands: [
      { y: 0, h: 70, fill: CARD, kind: "prose" },
      { y: 70, h: 90, fill: MUTED, kind: "image" },
      { y: 160, h: 70, fill: CARD, kind: "prose" },
      { y: 230, h: 90, fill: MUTED, kind: "blog" },
      { y: 320, h: 60, fill: CARD, kind: "cta" },
    ],
  },
  "tpl-resource-listing": {
    title: "Resource Listing",
    bands: [
      { y: 0, h: 100, fill: BRAND_LIGHT, kind: "hero" },
      { y: 100, h: 180, fill: CARD, kind: "gallery" },
      { y: 280, h: 100, fill: MUTED, kind: "cta" },
    ],
  },
  "tpl-resource-detail": {
    title: "Resource Detail",
    bands: [
      { y: 0, h: 80, fill: CARD, kind: "prose" },
      { y: 80, h: 100, fill: MUTED, kind: "image" },
      { y: 180, h: 70, fill: CARD, kind: "gallery" },
      { y: 250, h: 130, fill: MUTED, kind: "cta" },
    ],
  },
};

/** @param {number} w @param {number} h @param {LayoutSpec} spec */
function renderSvg(w, h, spec) {
  const bands = spec.bands
    .map((b) => `<rect x="0" y="${scaleY(b.y, h)}" width="${w}" height="${scaleY(b.h, h)}" fill="${b.fill}"/>`)
    .join("\n  ");

  const chrome = `
  <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.06)}" fill="${CARD}" stroke="${BORDER}" stroke-width="1"/>
  <circle cx="${w * 0.06}" cy="${h * 0.03}" r="${h * 0.012}" fill="${BRAND}"/>
  <rect x="${w * 0.12}" y="${h * 0.022}" width="${w * 0.12}" height="${h * 0.016}" rx="3" fill="${FG}" opacity="0.15"/>
  <rect x="${w * 0.72}" y="${h * 0.022}" width="${w * 0.08}" height="${h * 0.016}" rx="3" fill="${MUTED_FG}" opacity="0.35"/>
  <rect x="${w * 0.82}" y="${h * 0.018}" width="${w * 0.1}" height="${h * 0.024}" rx="5" fill="${BRAND}"/>`;

  const decor = spec.bands
    .map((b) => decorateBand(b, w, h))
    .filter(Boolean)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${spec.title} preview">
  <rect width="${w}" height="${h}" fill="${MUTED}"/>
  ${chrome}
  ${bands}
  ${decor}
  <text x="${w * 0.04}" y="${h - 8}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${Math.max(11, h * 0.028)}" font-weight="600" fill="${MUTED_FG}">${spec.title}</text>
</svg>`;
}

/** @param {number} v @param {number} totalH */
function scaleY(v, totalH) {
  const base = 380;
  return Math.round((v / base) * totalH);
}

/** @param {LayoutSpec["bands"][number]} band @param {number} w @param {number} h */
function decorateBand(band, w, h) {
  const y = scaleY(band.y, h);
  const bh = scaleY(band.h, h);
  const cx = w / 2;
  switch (band.kind) {
    case "hero":
    case "split-hero":
      return `
  <rect x="${w * 0.08}" y="${y + bh * 0.25}" width="${w * 0.45}" height="${bh * 0.12}" rx="4" fill="${FG}" opacity="0.12"/>
  <rect x="${w * 0.08}" y="${y + bh * 0.45}" width="${w * 0.35}" height="${bh * 0.07}" rx="3" fill="${MUTED_FG}" opacity="0.25"/>
  <rect x="${w * 0.08}" y="${y + bh * 0.65}" width="${w * 0.18}" height="${bh * 0.14}" rx="6" fill="${BRAND}"/>
  ${band.kind === "split-hero" ? `<rect x="${w * 0.58}" y="${y + bh * 0.2}" width="${w * 0.34}" height="${bh * 0.65}" rx="8" fill="${BRAND}" opacity="0.25"/>` : ""}`;
    case "features":
    case "gallery":
    case "team":
    case "blog": {
      const cols = band.kind === "team" ? 4 : 3;
      const gap = w * 0.03;
      const cardW = (w * 0.84 - gap * (cols - 1)) / cols;
      return Array.from({ length: cols }, (_, i) => {
        const x = w * 0.08 + i * (cardW + gap);
        const cardH = bh * 0.55;
        return `<rect x="${x}" y="${y + bh * 0.22}" width="${cardW}" height="${cardH}" rx="6" fill="${CARD}" stroke="${BORDER}"/>`;
      }).join("\n  ");
    }
    case "form":
      return `
  <rect x="${w * 0.2}" y="${y + bh * 0.15}" width="${w * 0.6}" height="${bh * 0.12}" rx="4" fill="${CARD}" stroke="${BORDER}"/>
  <rect x="${w * 0.2}" y="${y + bh * 0.35}" width="${w * 0.6}" height="${bh * 0.12}" rx="4" fill="${CARD}" stroke="${BORDER}"/>
  <rect x="${w * 0.2}" y="${y + bh * 0.55}" width="${w * 0.6}" height="${bh * 0.22}" rx="4" fill="${CARD}" stroke="${BORDER}"/>
  <rect x="${cx - w * 0.12}" y="${y + bh * 0.82}" width="${w * 0.24}" height="${bh * 0.12}" rx="6" fill="${BRAND}"/>`;
    case "pricing":
      return [0, 1, 2]
        .map((i) => {
          const cardW = w * 0.24;
          const x = w * 0.1 + i * (cardW + w * 0.04);
          return `<rect x="${x}" y="${y + bh * 0.15}" width="${cardW}" height="${bh * 0.7}" rx="6" fill="${i === 1 ? BRAND : CARD}" opacity="${i === 1 ? 0.9 : 1}" stroke="${BORDER}"/>`;
        })
        .join("\n  ");
    case "stats":
      return [0, 1, 2, 3]
        .map((i) => {
          const x = w * 0.08 + i * (w * 0.22);
          return `<rect x="${x}" y="${y + bh * 0.25}" width="${w * 0.18}" height="${bh * 0.5}" rx="4" fill="${CARD}" stroke="${BORDER}"/>`;
        })
        .join("\n  ");
    case "cta":
      return `
  <rect x="${cx - w * 0.2}" y="${y + bh * 0.25}" width="${w * 0.4}" height="${bh * 0.12}" rx="4" fill="${FG}" opacity="0.1"/>
  <rect x="${cx - w * 0.14}" y="${y + bh * 0.55}" width="${w * 0.28}" height="${bh * 0.16}" rx="6" fill="${BRAND}"/>`;
    case "faq":
      return `
  <rect x="${w * 0.12}" y="${y + bh * 0.12}" width="${w * 0.76}" height="${bh * 0.14}" rx="4" fill="${CARD}" stroke="${BORDER}"/>
  <rect x="${w * 0.12}" y="${y + bh * 0.32}" width="${w * 0.76}" height="${bh * 0.14}" rx="4" fill="${CARD}" stroke="${BORDER}"/>
  <rect x="${w * 0.12}" y="${y + bh * 0.52}" width="${w * 0.76}" height="${bh * 0.14}" rx="4" fill="${CARD}" stroke="${BORDER}"/>
  <rect x="${w * 0.12}" y="${y + bh * 0.72}" width="${w * 0.76}" height="${bh * 0.14}" rx="4" fill="${CARD}" stroke="${BORDER}"/>`;
    default:
      return `
  <rect x="${w * 0.08}" y="${y + bh * 0.3}" width="${w * 0.55}" height="${bh * 0.1}" rx="4" fill="${FG}" opacity="0.1"/>
  <rect x="${w * 0.08}" y="${y + bh * 0.5}" width="${w * 0.7}" height="${bh * 0.08}" rx="3" fill="${MUTED_FG}" opacity="0.2"/>`;
  }
}

mkdirSync(OUT, { recursive: true });

for (const [key, spec] of Object.entries(LAYOUTS)) {
  writeFileSync(join(OUT, `${key}-thumb.svg`), renderSvg(640, 400, spec));
  writeFileSync(join(OUT, `${key}-cover.svg`), renderSvg(960, 600, spec));
  console.log(`wrote ${key}-thumb.svg, ${key}-cover.svg`);
}

console.log(`Done — ${Object.keys(LAYOUTS).length * 2} preview files in ${OUT}`);
