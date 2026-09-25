# Per-breakpoint responsive styles (gap A5)

Per-device style overrides + hide-on-device for the OB-CMS page builder. The base
(desktop) style resolves inline as before; tablet/mobile overrides are emitted as
inline CSS custom properties and applied by **container-query** rules in
`blocks.css`, giving exact parity between the builder canvas and the public
renderer.

## Extended `StyleModel` shape

`StyleModel` already carried a `responsive` bag. Overrides live there as **partial
StyleModel layers** keyed by breakpoint, plus a per-layer `hidden` flag:

```jsonc
{
  "spacing": { "paddingTop": 48 },          // base / desktop
  "typography": { "fontSize": 24 },
  "responsive": {
    "tablet": { "spacing": { "paddingTop": 24 } },
    "mobile": {
      "spacing": { "paddingTop": 8 },
      "typography": { "fontSize": 14 },
      "hidden": true                          // hide-on-mobile
    }
  }
}
```

- Each layer is a partial `StyleModel` (same `layout`/`spacing`/`typography`/… sections).
- `hidden: true` on a layer hides the block at that breakpoint.
- Backward-compatible: a style with no `responsive` layer resolves and serializes
  byte-identically to before — and emits **zero** extra CSS.

Breakpoints (match the existing container-query system in `blocks.css`):
`desktop` (base), `tablet` ≤1023px, `mobile` ≤767px.

## How overrides resolve to CSS

Two outputs, both pure / SSR-safe, from `packages/block-schema/src/styles.ts`:

1. **`resolveStyles(styles, breakpoint)`** — unchanged cascade. `tablet` = desktop
   ⊕ tablet; `mobile` = desktop ⊕ tablet ⊕ mobile. Used to compute override values.
2. **`responsiveCssVars(styles)`** (new) — compares each breakpoint's resolved value
   to the desktop baseline and emits an inline CSS var **only for properties that
   actually change**: `--ob-r-<bp>-<prop>` (e.g. `--ob-r-mobile-paddingTop: 8px`).
   A hidden layer emits `--ob-r-<bp>-display: none`. The supported property set is
   `RESPONSIVE_CSS_PROPS` (display, flex direction/justify/align, text align,
   font size/weight, color, background, padding, margin, border radius, width,
   max-width, gap) — matched 1:1 to the Style panel.

`cssFromStyles` (`packages/blocks/src/lib.tsx`) merges the desktop inline style with
these vars in one object — a single code path shared by canvas + renderer.

`blocks.css` applies the vars inside container queries, scoped + guarded so unset
blocks are never touched:

```css
@container ob (max-width: 767px) {
  .ob-site [style*="--ob-r-mobile-paddingTop"] {
    padding-top: var(--ob-r-mobile-paddingTop) !important;
  }
  /* …one rule per RESPONSIVE_CSS_PROP, tablet + mobile… */
}
```

Because `.ob-site` is `container-type: inline-size` and the builder canvas is a
width-constrained `.ob-site`, the same `@container` rules fire in the editor preview
(device toggle resizes the container) and on the renderer (real viewport) — true
parity, SSR-safe, no JS.

## Panel UX (`apps/admin/.../property/StyleControls.tsx`)

- **Device switcher** (Desktop / Tablet / Mobile) bound to the SAME
  `editorUiStore.breakpoint` as the toolbar's responsive-preview toggle — switching
  either one scopes edits and updates the preview together.
- On **Desktop**, edits write the base (`styles.<section>.<key>`). On **Tablet /
  Mobile**, edits write the override layer (`styles.responsive.<bp>.<section>.<key>`).
- Each field shows an **override dot** when set for the active device and a
  **reset** (↺) affordance that clears the override so it re-inherits.
- A **Hide on `<device>`** toggle (tablet/mobile) writes `responsive.<bp>.hidden`.

## Backward-compat & round-trip

- Overrides persist inside the node `styles` jsonb under `responsive.<bp>` — no
  schema/migration change; `mergeStyleDefaults` already deep-merges the layers.
- Pages with no overrides emit no vars and resolve unchanged (verified by tests in
  `src/__tests__/responsive-styles.test.ts`).
