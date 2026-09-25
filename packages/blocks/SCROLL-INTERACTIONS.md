# Scroll / Entrance Interactions

Reveal-on-scroll (fade / slide / zoom), stagger via per-block delay, and parallax
for OB-CMS blocks. Authored in the builder, executed by a tiny SSR-safe client
script in the renderer. Editor↔renderer parity; **degrades gracefully without JS**.

## 1. The `interactions` shape

`interactions` is stored as a sibling section **inside a node's StyleModel**
(`styles.interactions`). This is deliberate: every block already calls
`cssFromStyles(styles)` on its root, so routing interactions through that single
shared path gives editor/renderer parity with **zero per-block edits**.

```ts
interface Interactions {
  reveal?: {
    effect: "none" | "fade" | "slide-up" | "slide-down"
          | "slide-left" | "slide-right" | "zoom";
    duration?: number; // seconds, default 0.6
    delay?: number;    // seconds, default 0  (use for stagger)
    once?: boolean;    // default true — animate only the first entry
  };
  parallax?: { speed: number }; // translateY factor vs scroll; 0 = off
}
```

Schema + helpers live in `packages/block-schema/src/styles.ts`:
`REVEAL_EFFECTS`, `Interactions`, `getInteractions`, `hasInteractions`,
`interactionCssVars`.

## 2. Attribute / CSS emission

`interactionCssVars(styles)` turns the shape into inline CSS custom properties.
It emits **nothing** when no interaction is set, so pages without interactions
render byte-identically (same guard pattern as `--ob-r-*` responsive and
`--ob-s-*` state vars).

| Interaction | Emitted inline vars |
|---|---|
| reveal | `--ob-reveal-effect`, `--ob-reveal-dur`, `--ob-reveal-delay`, `--ob-reveal-once:0` (only when `once:false`) |
| parallax | `--ob-parallax-speed` |

`cssFromStyles` (in `packages/blocks/src/lib.tsx`) appends these onto the block
root's inline `style`. The CSS in `blocks.css` keys off the **presence** of the
var (`[style*="--ob-reveal-effect"]`, `[style*="--ob-reveal-effect:slide-up"]`,
`[style*="--ob-parallax-speed"]`) — no `data-*` attribute or per-block change
needed.

## 3. The `ScrollFX` script

`apps/renderer/src/components/scroll-fx.tsx` — a `"use client"` component, SSR-safe
(no `window` at module load), mounted once at the end of the renderer page
(`app/[[...slug]]/page.tsx`). On mount it:

1. Adds `js-ready` to every `.ob-site` root — this is what **activates** the
   hidden/offset initial state in CSS.
2. Sets up **one** `IntersectionObserver` adding `.ob-revealed` to
   `[style*="--ob-reveal-effect"]` elements as they enter; respects `once`
   (unobserve) vs `once:false` (toggle off on exit).
3. Runs **one** rAF-throttled `scroll`/`resize` loop translating
   `[style*="--ob-parallax-speed"]` elements by `-(viewport offset) * speed`.

It is a **no-op** when no reveal/parallax elements exist (no observer, no
listener registered).

## 4. No-JS & reduced-motion safety

- The hidden/offset state is gated behind `.ob-site.js-ready
  [...]:not(.ob-revealed)`. Without the script (JS off/failed) `js-ready` is
  never added → content is **fully visible**, never permanently hidden.
- `@media (prefers-reduced-motion: reduce)` forces visibility and disables
  transitions; the script also bails early (reveals everything, skips parallax).
- The **builder canvas** never gets `js-ready` (no ScrollFX there), so blocks
  show their final revealed state in the editor — content is never hidden while
  authoring. → editor↔renderer parity.

## 5. The Interactions panel

`apps/admin/src/views/builder/property/InteractionsControls.tsx` — a
self-contained component mounted as a new **Motion** tab in `PropertyPanel.tsx`
(does not touch `StyleControls.tsx`). Effect dropdown, duration/delay, "animate
once" toggle, and parallax speed. Writes `styles.interactions.*` via the same
`useUpdateProp` (`setProp`) helper the Style panel uses.

## Tests

`packages/block-schema/src/__tests__/interactions.test.ts` covers
`interactionCssVars` / `hasInteractions` / `getInteractions` (defaults, `none`,
duration/delay/once, parallax 0-guard, reveal+parallax compose, and that
`resolveStyles` is unaffected).
