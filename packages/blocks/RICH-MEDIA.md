# Rich Media Blocks

High-impact media primitives for marketing pages: an **Icon** block (lucide
library + searchable picker), **inline SVG** support on the Image block, a
**Video** block (file `<video>` + YouTube/Vimeo embeds + background mode), and
**Unsplash stock-photo search** in the media picker.

All block components are pure, `forwardRef`, SSR-safe React (no `window`/
`document` at module load) and are shared byte-identically by the admin builder
canvas and the Next.js renderer.

Block count after this change: **34** registered block types.

---

## 1. Icon block (`blocks/icon.tsx`)

Renders a single [lucide](https://lucide.dev) icon by PascalCase `name`.

| prop | type | default | notes |
|------|------|---------|-------|
| `name` | string | `"Sparkles"` | lucide PascalCase name (e.g. `Camera`, `ArrowRight`). Unknown → dashed-box fallback. |
| `size` | number | `32` | px |
| `color` | string | `"currentColor"` | literal color **or** a theme token, e.g. `hsl(var(--primary))` |
| `strokeWidth` | number | `2` | |
| `url` | string | – | optional link wrapper (sanitized via `SafeLink`) |
| `label` | string | – | accessible label; when set the icon is exposed as `role="img"` |

- Name→component lookup uses lucide's static `icons` map (`resolveIcon`), guarded
  so an unknown/empty name renders a safe fallback instead of crashing.
- `color` is applied to the wrapping span + lucide `color` prop, so themed pages
  recolor automatically via CSS vars.
- `lucide-react@0.469.0` is a dependency of `@ob-cms/blocks` (transitively
  installed for the renderer too).

### Icon picker control

`apps/admin/.../property/IconPickerField.tsx`, wired via the new `icon` control
kind in `introspect.ts` (triggered by the Icon block's `name` prop). Lucide ships
~1k icons, so the grid renders a **curated common set** by default and searches
the **full set** by substring, **capped at 120** results for performance. The
current selection shows a live preview.

---

## 2. Inline SVG (Image block)

The Image block gains an optional `inlineSvg` prop. When set, the sanitized SVG
markup is rendered inline (precedence over `imageUrl`) so vector logos/icons stay
crisp and themeable via `currentColor`. Edited via a textarea in the property
panel.

### SVG sanitize policy (`block-schema/src/sanitize.ts` → `sanitizeSvg`)

Pure string allow-list sanitizer (no DOM; identical in builder + SSR). Input must
begin with `<svg`.

- **Allowed tags:** `svg, g, path, circle, ellipse, line, polyline, polygon,
  rect, defs, linearGradient, radialGradient, stop, title, desc, clipPath, mask,
  pattern, symbol, text, tspan`.
- **Allowed attributes:** presentation + geometry only — `viewBox, xmlns, width,
  height, fill, stroke, stroke-*, fill-rule, clip-rule, *-opacity, opacity, d,
  points, x/y/x1/y1/x2/y2, cx/cy/r/rx/ry, transform, gradient*, offset,
  stop-color, stop-opacity, class, id, preserveAspectRatio, clip-path, mask,
  color, vector-effect, text-anchor, font-*, dx, dy, spreadMethod,
  patternUnits`.
- **Stripped:** `<script>`, `<style>`, `<foreignObject>`, `<image>`, `<use>`, all
  animation elements; every `on*` handler; `href`/`xlink:href` (no external/script
  refs); `url(javascript:…)`/`url(data:…)`; any non-allowlisted tag/attr; XML
  decls, DOCTYPE, comments.

---

## 3. Video block (`blocks/video.tsx`)

| prop | type | default | notes |
|------|------|---------|-------|
| `src` | string | – | direct file URL **or** a YouTube/Vimeo link |
| `poster` | string | – | image (picker reused) — file mode only |
| `provider` | `auto\|file\|youtube\|vimeo` | `auto` | auto-detected from `src` |
| `mode` | `inline\|background` | `inline` | `background` = object-fit cover, no controls, forced muted+loop+autoplay |
| `autoplay` `loop` `muted` `controls` | boolean | see schema | autoplay forces muted (browser policy) |

- **File URLs** (`.mp4/.webm/.ogg/.mov/.m4v` or any non-recognized URL) →
  native `<video>` with `playsInline`, optional `poster`.
- **YouTube/Vimeo links** → `resolveVideoUrl` builds the canonical embed
  (`youtube-nocookie.com/embed/<id>`, `player.vimeo.com/video/<id>`) rendered as a
  **sandboxed iframe** (16:9 responsive in inline mode, cover in background mode).
  Embed-host trust reuses the existing iframe allowlist policy.
- **Background mode** absolutely-positions the media to cover its container — drop
  it as the first child of a `position:relative` Section/Container for a hero
  background video.
- Helpers added to `sanitize.ts`: `resolveVideoUrl(url, forced?)`,
  `isVideoFileUrl(url)`.

---

## 4. Unsplash stock search

A **Stock** tab in the media picker (`media/components/StockSearch.tsx`, wired
into `MediaPickerDialog.tsx` via the shared `MediaPickerProvider`).

- Reads the key from **`import.meta.env.VITE_UNSPLASH_ACCESS_KEY`**.
- **Key absent →** the tab shows "Set `VITE_UNSPLASH_ACCESS_KEY` to enable stock
  search"; Library + Upload tabs keep working.
- **Key present →** debounced search of `https://api.unsplash.com/search/photos`
  (`Authorization: Client-ID <key>`). A selected photo synthesizes a `MediaItem`
  (`id: "unsplash:<id>"`, `url` = the regular image URL, `alt` carries the
  photographer credit) consumed by the normal picker flow. An Unsplash credit line
  is shown (attribution guideline).

### Env var

```
# apps/admin/.env
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```
