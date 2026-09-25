# @ob-cms/blocks — Render Fidelity Notes (W1b → live-site parity)

Reference: the Craft.js POC (`craftjs-cms-poc/`) which mirrors
<https://www.officebeacon.com/>. Goal: make `RenderLayout` of the OB export
(`team-docs/reference-assets/officebeacon-homepage.poc-export.json`) render as
close as possible to the live site, while keeping the registry contract,
SSR-safety, and tests intact.

## The headline fix: a shipped global stylesheet

The components already emit the POC's `ob-*` / `cms-*` class names, but **no CSS
backed them** in the port and there was **no `.ob-site` container** to activate
the responsive system. That was the dominant fidelity gap.

### `src/blocks.css` (new — the global-style export)

A single, ship-once stylesheet ported from the POC's
`components/marketing/marketing.css` + `components/marketing/ob-responsive.css`,
plus a scoped reset, the site font stack, container tokens, and a typography
scale. It contains:

- **Fonts**: `@import` of **Open Sans** (body) + **Rethink Sans** (headings) —
  the live OfficeBeacon stack. Exposed as `--ob-font-body` / `--ob-font-head`.
- **Reset**: `box-sizing`, margin-zeroed headings/paragraphs/lists — scoped to
  `.ob-site` so it never leaks into the host app.
- **Design tokens** on `.ob-site`: `--ob-brand` (#147eff), `--ob-ink` (#002244),
  `--ob-muted`, `--ob-border`, `--ob-design-width` (1280px), `--ob-gutter`.
- **Container band**: `.cms-container`, `.cms-fluid-container`, nav/topbar/hero
  inners all lock to `max-width: var(--ob-design-width)` and center.
- **Every block class**: feature/step/counter/quote/video/article/logo cards,
  carousels, navbar dropdown + mega panels, topbar, footer grid.
- **Responsive lock**: the POC's **container-query** system
  (`container-name: ob`) for the Nest-Hub-Max 1280px desktop lock and the
  tablet/mobile breakpoints, including touch-swipe carousels and the
  desktop/mobile navbar toggle.

### How the renderer includes it

```ts
// apps/renderer — once, in the root layout (e.g. app/layout.tsx)
import "@ob-cms/blocks/blocks.css";
```

The package exposes it via `package.json#exports`:

```jsonc
"exports": {
  ".": "./src/index.ts",
  "./blocks.css": "./src/blocks.css"
}
```

For Next.js font optimization you may instead load Open Sans + Rethink Sans via
`next/font/google` and set `--ob-font-body` / `--ob-font-head` on the
`.ob-site` element — the CSS reads those variables, so the `@import` is a
zero-config fallback, not a hard requirement.

### The `.ob-site` wrapper — `<OBSiteRoot>` (new)

`src/site-root.tsx` exports `OBSiteRoot`, which renders
`<div class="ob-site cms-site">`. **`RenderLayout` now wraps its output in this
by default** (`wrap` prop, default `true`), so:

- the scoped reset/tokens/fonts apply,
- `container-type: inline-size; container-name: ob` is established so the
  responsive `@container ob (...)` rules fire.

The builder canvas (which provides its own `.ob-site`) can pass
`<RenderLayout wrap={false} />`. `OBSiteRoot` is also exported standalone.

## Per-block fidelity improvements

| Block | What changed |
|---|---|
| **Navbar** | Desktop nav + CTA now wrapped in `navbar-desktop`; added a `navbar-mobile` nav (CSS container-queries toggle them at <1024/<768px so the navbar collapses like the live site). Dropdown/mega items render `ob-nav-item-wrap` + `ob-nav-dropdown-panel` / `ob-nav-mega-panel` (hover/focus-within reveal via CSS). CTA tagged `ob-btn ob-btn--primary` for the hover color. |
| **Logo Carousel** | Added **marquee** variant (`marquee` prop → `ob-logo-carousel--marquee`, logos duplicated for a seamless `-50%` keyframe loop) — matches the live partnership-logo strip. Slider + static variants retained. |
| **Video Testimonial Carousel** | Nav bar tagged `ob-video-testimonial-carousel__nav` so the responsive rules show/hide it correctly; touch-swipe on mobile now works via the shipped `.ob-carousel--touch` CSS. |
| **Content Carousel / Article Card Grid** | Now have real CSS backing for `ob-content-carousel__*`, the desktop static-grid override for article carousels, and touch-swipe on mobile. |
| **Hero / Feature / Step / Counter** | DOM + class names already matched the POC; they now render correctly because `blocks.css` supplies the card/grid/typography styles and the `cms-hero-split` / `cms-hero-centered` container band + breakpoints. |
| **Footer** | `cms-footer` background + `cms-footer-columns` grid now styled (dark footer like the live site) and collapse to 1 column on mobile. |
| All others (Heading, Paragraph, Section Heading, Image, Button, Link, Divider, Social Icons, Copyright, layout primitives) | Unchanged DOM/props; benefit from the global reset, tokens, fonts and container band. |

## Style-engine parity

`packages/block-schema/src/styles.ts` (`resolveStyles` / `applyMiniStyles`) was
already a faithful, complete port of the POC's `resolveStyles.js`: gradients
(linear/radial/conic), text-gradient clipping, border-image gradients,
transforms, filters, text effects, glassmorphism, per-breakpoint merge
(desktop/tablet/mobile), and the fluid `clamp()` engine. **No changes were
needed** — per-node `styles` resolve identically to the POC. Verified against
`sectionToCss` field-by-field.

## Prop-schema additions (additive only)

- `block-props.ts → logoCarouselSchema`: added optional `marquee: boolean`.
  Schemas are `.passthrough()`, so this is purely for builder discoverability;
  no existing prop removed or renamed.

## Preserved / not broken

- `blockRegistry`, `blockComponents`, all 28 `resolvedName` keys, prop names,
  and `.craft` metadata — unchanged.
- `RenderLayout` signature is backward-compatible (new `wrap`/`className` are
  optional, default `wrap: true`).
- SSR-safe: `blocks.css` is pure CSS; `OBSiteRoot` is pure React; interactive
  blocks keep `"use client"` and only enable arrows/autoplay after `useMounted`.
  No `window`/`document` at module top-level.
- Round-trip + render tests untouched and still satisfied: the wrapper adds a
  `<div class="ob-site cms-site">` around the same tree (markup grows, never
  shrinks; "Remote Teams" hero text + 28 types still present).

## Known remaining gaps (to iterate with the orchestrator's visual diff)

1. **Mobile nav is a simplified inline list**, not the POC's slide-in drawer
   (`ob-mobile-menu__panel` + hamburger). The drawer needs client state; the
   inline fallback is SSR-clean and acceptable above the fold but not pixel-exact
   on small screens.
2. **Social icons render text labels** (no icon font/SVG lib to stay SSR-safe &
   dependency-free). The live site uses brand glyphs — swap to inline SVGs if
   exact icons are required.
3. **Video testimonial modal**: cards link out / open in a new tab rather than
   the POC's in-page `ob-video-modal` lightbox. Can be added as a client-only
   enhancement.
4. **Navbar hover-link color** (`linkHoverStyles`) from the export isn't emitted
   as a per-instance `<style>` yet — global `.ob-btn` hover is covered; per-link
   hover tints would need a scoped style tag.
5. Fine-grained spacing between sections depends on each node's `styles`
   (resolved faithfully); any residual vertical-rhythm differences are content
   data, not engine, and tune via the export's `spacing` values.
