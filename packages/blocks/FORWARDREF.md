# forwardRef conversion — `@ob-cms/blocks`

Every exported block component now uses `React.forwardRef` and attaches the
forwarded `ref` to its **single outermost root DOM element**, so the Craft.js
builder can connect drag/select to each block's real DOM node (no more
`display:contents` boxless wrapper). Each component sets `displayName` to its
registry `resolvedName`. Visual output is unchanged — ref attachment is
invisible, no new wrapper boxes were added.

## Per-component root element

| File | Component | `displayName` | Ref root element |
|------|-----------|---------------|------------------|
| `blocks/layout.tsx` | `Section` | `Section` | dynamic `<Tag>` (default `<section>`) |
| `blocks/layout.tsx` | `Container` | `Container` | `<div>` |
| `blocks/layout.tsx` | `Row` | `Row` | `<div>` |
| `blocks/layout.tsx` | `Column` | `Column` | `<div data-cms-col>` |
| `blocks/layout.tsx` | `Grid` | `Grid` | `<div>` |
| `blocks/layout.tsx` | `Div` | `Div` | dynamic `<Tag>` (default `<div>`) |
| `blocks/layout.tsx` | `Divider` | `Divider` | `<hr>` |
| `blocks/content.tsx` | `Heading` | `Heading` | outer `<div>` (wraps dynamic `<h{n}>`) |
| `blocks/content.tsx` | `Paragraph` | `Paragraph` | outer `<div>` (wraps `<p>`) |
| `blocks/content.tsx` | `SectionHeading` | `SectionHeading` | `<div>` |
| `blocks/content.tsx` | `Image` | `Image` | `<figure>` |
| `blocks/content.tsx` | `Button` | `Button` | `<span>` |
| `blocks/content.tsx` | `Link` | `Link` | `<span>` |
| `blocks/navigation.tsx` | `Topbar` | `Topbar` | `<div class="ob-topbar">` |
| `blocks/navigation.tsx` | `Navbar` | `Navbar` | `<header class="cms-navbar">` (via the `header()` helper, covers all branches incl. `children`) |
| `blocks/footer.tsx` | `Footer` | `Footer` | `<footer>` |
| `blocks/footer.tsx` | `FooterColumns` | `Footer Columns` | `<div>` |
| `blocks/footer.tsx` | `FooterLinks` | `Footer Links` | `<nav>` |
| `blocks/footer.tsx` | `SocialIcons` | `Social Icons` | `<div>` |
| `blocks/footer.tsx` | `CopyrightBlock` | `Copyright Block` | `<p>` |
| `blocks/marketing.tsx` | `HeroSection` | `Hero Section` | `<section>` (both `children` and default branches) |
| `blocks/marketing.tsx` | `FeatureList` | `Feature List` | `<div class="cms-feature-grid">` |
| `blocks/marketing.tsx` | `CounterSection` | `Counter Section` | `<section>` |
| `blocks/marketing.tsx` | `StepCards` | `Step Cards` | `<section>` |
| `blocks/carousels.tsx` | `LogoCarousel` | `Logo Carousel` | `<div class="ob-logo-carousel*">` (all 3 marquee/slider/static branches) |
| `blocks/carousels.tsx` | `ContentCarousel` | `Content Carousel` | `<div class="ob-content-carousel">` |
| `blocks/carousels.tsx` | `VideoTestimonialCarousel` | `Video Testimonial Carousel` | `<div class="ob-content-carousel ...">` |
| `blocks/carousels.tsx` | `ArticleCardGrid` | `Article Card Grid` | `<section>` (carousel) / `<div>` (grid) — ref typed `HTMLElement`, narrowed to `HTMLDivElement` on the grid branch |

28 blocks total — all converted.

## Structural tweaks

- **No Fragment roots existed.** Every block already had a single outer DOM
  element, so no transparent wrapper elements were added.
- **`Heading` / `Paragraph`** keep their existing outer `<div>` wrapper (the
  height→minHeight fix lives on the inner element); the ref attaches to that
  existing outer `<div>` — no new box.
- **`Navbar`** renders its root through a `header()` helper used by every return
  path (including the `children` passthrough); the ref was added once on that
  `<header>` so all branches are covered.
- **`ArticleCardGrid`** has two root tags (`<section>` for carousel, `<div>` for
  grid). Typed `forwardRef<HTMLElement>`; the grid branch casts the ref to
  `React.Ref<HTMLDivElement>`.
- **`CanvasProps`** (layout.tsx) had an index signature `[key: string]: unknown`
  that, under `forwardRef`'s prop inference, widened every destructured prop to
  `unknown`. It was unused by the components and removed — no behavior change.

## Registry / type changes (`registry.tsx`)

- `BlockComponent` widened from `React.FC<any>` to
  `React.FC<any> | React.ForwardRefExoticComponent<any>` so the registry can
  hold forwardRef components and both usages type-check:
  - renderer (`RenderLayout`) renders `<Comp {...props}>{children}</Comp>` with
    **no ref** (unchanged);
  - admin (`createCraftBlock`) can pass a connector ref into the same component.
- `RenderLayout`, `resolveComponent`, `BlockRegistryEntry`, `blockComponents`,
  `REGISTERED_BLOCK_TYPES`, the `.craft` metadata, `OBSiteRoot`/`blocks.css`
  exports and all `resolvedName` keys are unchanged.

## Tests

- `packages/blocks` + `packages/block-schema` tests pass (`6` + `10`).
- The "resolves every node type to a real component" assertion was updated from
  `typeof component === "function"` to also accept a forwardRef object (which has
  a `.render` function) — forwardRef exotic components are objects, not
  functions; the test's intent (renderable component) is preserved.
- Full monorepo `type-check` passes (14/14 turbo tasks).
