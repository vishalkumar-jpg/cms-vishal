# Image block — responsive published output

The Image block (`src/blocks/content.tsx`) emits modern, performant HTML by
consuming the responsive/next-gen variants the media pipeline already generates
(see `apps/api/MEDIA-OPTIMIZATION.md`). It is **self-contained from props** — no
renderer-side fetch — so the editor preview and the published page render
byte-identical, SSR-safe, with **zero client JS** required for the image.

## Data model (props on the Image block)

Captured automatically when an image is chosen from the media library
(`apps/admin/.../ContentControls.tsx` → `applyMediaItem`), stored alongside
`imageUrl`/`altText`, and validated by `imageSchema` in
`packages/block-schema/src/block-props.ts` (passthrough → round-trips cleanly):

| prop | type | source / role |
| --- | --- | --- |
| `imageUrl` | `string` | the original/full `MediaItem.url` — the `<img src>` fallback. Bindable. |
| `altText` | `string` | alt text (auto-filled from `MediaItem.alt`; bindable). |
| `variants` | `{ width, format?, url, bytes? }[]` | derivatives → `srcset` / `<picture>` sources. |
| `intrinsicWidth` / `intrinsicHeight` | `number` | the source's pixel dimensions → `width`/`height` attrs to reserve space. |
| `focalPoint` | `{ x, y }` (0–1) | → CSS `object-position` so smart crops stay framed. |
| `sizes` | `string` | the `sizes` attribute (default `"100vw"`; overridable). |
| `loading` | `"lazy" \| "eager"` | loading strategy (default `lazy`). |

`variants`, `intrinsicWidth`, `intrinsicHeight`, `focalPoint` are machine-managed
and hidden from the auto-generated property panel (`introspect.ts` HIDDEN_FIELDS);
`sizes` (text) and `loading` (select) are user-facing knobs. Alt text already had
a control.

## Rendered output

`srcSetFor(variants, format?)` builds an ascending, de-duped
`"<url> <width>w, …"` list.

- **With next-gen variants** → a `<picture>`: an `image/avif` `<source>` first
  (if any avif variants), then `image/webp`, then the original-format `<img>`
  fallback last. Each `<source>` and the `<img>` carry the matching `srcset` +
  `sizes`.
- **Plain `<img>`** carries: `src`, `alt`, `srcset` (all variants), `sizes`,
  intrinsic `width`/`height` (→ no CLS), `decoding="async"`, and
  `loading="lazy"` (or `loading="eager"` + `fetchpriority="high"` for
  above-the-fold/LCP images when `loading: "eager"`).
- `object-position` is set from `focalPoint` (`x*100% y*100%`).

## Backward-compat & graceful degradation

- **External / pasted URL with no variants** → a plain lazy `<img src>` exactly
  as before: no `<picture>`, no `srcset`, no `sizes`. (Verified by test.)
- **Existing images** (just `imageUrl`) render unchanged — no regression; the
  OB-export round-trip and render tests stay green.
- **Inline SVG** (`inlineSvg`) still takes precedence, sanitized as before.
- **Data-binding**: `imageUrl`/`altText` continue to resolve via `useBoundProp`.
- **Empty / processing** media (variants not yet generated) → falls back to the
  plain lazy `<img>`; companion props are cleared on pick so nothing is stale.

## Tests

`packages/blocks/src/__tests__/render.test.tsx` covers: `<picture>`/webp `srcset`
with all four widths + `sizes` + intrinsic `width`/`height` + lazy + async;
focal-point `object-position` + custom `sizes`; eager/priority; and the
no-variants plain-`<img>` backward-compat fallback. XSS/alt tests stay green.
