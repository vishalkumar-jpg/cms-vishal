# Element state styling (hover / focus / active)

Per-state appearance overrides for the OB-CMS page builder. A block's base style
resolves inline as before; hover/focus/active overrides are emitted as inline CSS
custom properties and applied by **real pseudo-class rules** (`:hover` /
`:focus-visible` / `:active`) in `blocks.css`. Pure CSS → SSR-safe, no client JS,
and byte-identical between the builder canvas and the public renderer (the block
component is shared). Mirrors the per-breakpoint `responsive` mechanism (see
`RESPONSIVE-STYLES.md`).

## Extended `StyleModel` shape

`StyleModel` carries an optional `states` bag. Each state is a **partial
StyleModel layer** (same `colors`/`borders`/`shadows`/`effects`/… sections):

```jsonc
{
  "colors": { "backgroundColor": "#fff", "textColor": "#111" }, // base
  "states": {
    "hover":  { "colors": { "backgroundColor": "#000" }, "effects": { "transform": { "scale": 1.05 } } },
    "focus":  { "shadows": { "boxShadow": "0 0 0 3px rgba(20,126,255,.4)" } },
    "active": { "effects": { "opacity": 0.85 } }
  }
}
```

- Each layer is a partial `StyleModel`, resolved by merging ON TOP of the base.
- Backward-compatible: no `states` (or empty layers) → resolves & serializes
  byte-identically and emits **zero** extra CSS. `mergeStyleDefaults` already
  deep-merges `states.{hover,focus,active}`.

## How overrides resolve to CSS

From `packages/block-schema/src/styles.ts`:

`stateCssVars(styles)` — for each state, merges the state layer over the base,
resolves it, and diffs against the base. It emits an inline CSS var **only for
props that actually change**: `--ob-s-<state>-<prop>` (e.g.
`--ob-s-hover-backgroundColor: #000`). When any state override exists and the
block has no transition of its own, it also emits `--ob-s-transition`
(`DEFAULT_STATE_TRANSITION`, ~150ms ease) so the change animates.

Supported props (`STATE_CSS_PROPS`): `color`, `backgroundColor`,
`backgroundImage` (background / gradient), `borderColor`, `border`, `boxShadow`,
`opacity`, `transform`, `textDecoration`. (`scale` is authored via
`effects.transform.scale` and folds into the `transform` var.)

`cssFromStyles` (`packages/blocks/src/lib.tsx`) merges base inline style +
`--ob-r-*` (responsive) vars + `--ob-s-*` (state) vars into one object — a single
shared code path for canvas + renderer.

`blocks.css` applies them with guarded pseudo-class rules:

```css
.ob-site [style*="--ob-s-transition"] { transition: var(--ob-s-transition) !important; }
.ob-site [style*="--ob-s-hover-backgroundColor"]:hover {
  background-color: var(--ob-s-hover-backgroundColor) !important;
}
/* …one rule per STATE_CSS_PROP × {hover, focus, active}… */
```

Focus uses `:focus-visible` (with a `:focus` fallback). Active is emitted after
hover in source order so `:active` wins while pressed. The `[style*=…]` guard
means state-less blocks are never touched.

## Precedence & composition with responsive

- **States are additive to the base** — the state layer merges over the base
  (desktop) style and the resulting pseudo-rule applies at **every breakpoint**,
  so a hover override stays active on tablet/mobile too.
- State vars (`--ob-s-*`), responsive vars (`--ob-r-*`) and the base inline style
  live on the same element in **separate namespaces** with **separate selectors**,
  so they coexist without clobbering.
- While interacting at a breakpoint, the **state pseudo-rule wins**: both the
  responsive container-query rule and the state rule use `!important`, but the
  state rule's pseudo-class makes it more specific, so e.g. a hover background
  beats a responsive background at mobile width.

## Panel UX (`apps/admin/.../property/StyleControls.tsx`)

- A compact **state switcher** (Default · Hover · Focus · Active) sits next to the
  Desktop/Tablet/Mobile device switcher.
- On **Default**, edits write the base / responsive layer as before. On
  **Hover/Focus/Active**, edits write `styles.states.<state>.<section>.<key>`
  (the base state layer — applies on the pseudo-class at all breakpoints; the
  per-breakpoint path is suppressed while a state is active so state + responsive
  compose cleanly).
- Each field shows an **override dot** when set on the active state and a
  **reset** (↺) that clears it so it re-inherits the base — mirroring the
  responsive override-dot UX.
- An **"Applies on `:hover`/`:focus`/`:active`"** hint notes that unset fields fall
  back to the base and that changes animate via the transition.

## Tests

`src/__tests__/element-states.test.ts` — var emission, only-changed-props,
default-transition emission/suppression, focus/active independence,
box-shadow/transform/border, responsive composition, supported-prop whitelist,
and backward-compat (no states → `{}`). Existing `block-schema` + `blocks` suites
stay green.
