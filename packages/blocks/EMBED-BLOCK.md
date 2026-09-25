# Embed / Custom-HTML block (Gap A8)

A guard-railed block that lets marketers paste third-party embed code (YouTube /
Vimeo iframes, Calendly, HubSpot forms, Google Maps/Forms, Loom, Spotify,
Typeform, custom formatting HTML) onto a page. The pasted HTML is **always**
sanitized before being injected — never rendered raw.

## The block

- Component: `packages/blocks/src/blocks/embed.tsx` — `Embed`, a
  `React.forwardRef<HTMLDivElement, { html?: string; styles? }>` with
  `displayName = "Embed"`.
- Renders the sanitized HTML via `dangerouslySetInnerHTML` using the output of
  `sanitizeEmbedHtml(html)` **only**.
- SSR-safe: no `window`/`document` at module load or render; the sanitizer is a
  pure string function, so the builder canvas and the SSR renderer produce
  byte-identical output (the component is shared → parity is automatic).
- Empty state: renders a dashed placeholder reading **"Add embed code in the
  panel"** when `html` is empty/whitespace.
- Registered in `packages/blocks/src/registry.tsx` as `"Embed"`
  (`isCanvas: false`, `defaultProps { html: "" }`, craft meta auto-built).
- Zod schema `embedSchema` (`{ html?: string (default ""), styles? }`) in
  `packages/block-schema/src/block-props.ts`, keyed `"Embed"` in
  `blockPropSchemas`.
- Added to the builder palette under **Content** in
  `apps/admin/src/views/builder/blocks/categories.ts`.

## Sanitize policy (`sanitizeEmbedHtml`, in `block-schema/src/sanitize.ts`)

A conservative **superset** of the existing `sanitizeHtml` allow-list policy:

**Allowed**

- All tags `sanitizeHtml` already allows: `p br b strong i em u s span a ul ol li
  h1–h6 blockquote code pre` (with its existing safe-attr / safe-URL rules).
- `<iframe>` — **only** when `src` is an absolute `https://` URL whose host is on
  a curated allowlist (or a subdomain of one): youtube(.com/-nocookie),
  vimeo/player.vimeo, calendly, hsforms/hubspot/meetings.hubspot, google /
  maps.google / docs.google / forms.gle, loom, open.spotify/spotify, typeform,
  wistia, twitch, soundcloud, codepen, codesandbox, airtable, tally.
  - Allowed iframes are **forced** to carry
    `sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"`
    (any author-supplied `sandbox` is discarded — no `allow-top-navigation`).
  - Kept iframe attrs: `width height title frameborder allow allowfullscreen
    loading style name scrolling` (width/height/style restricted to a safe
    character set). All others, and all `on*` handlers, are dropped.

**Stripped**

- `<script>`, `<style>`, `<object>`, `<embed>`, `<link>`, `<meta>` (tag +
  content).
- Iframes from any non-allowlisted host, non-https iframes, and iframes with no
  safe `src`.
- All inline event handlers (`onload`, `onclick`, …) and
  `javascript:` / `data:` / `vbscript:` URLs.

`<script>`-based embeds (e.g. some HubSpot/Calendly "inline" widget snippets) are
**not** supported — use the iframe form of those embeds, which is the common
case. This is a deliberate security tradeoff: we never disable sanitization.

## Property-panel control

A new `"html"` `ControlKind` in
`apps/admin/src/views/builder/property/introspect.ts`: the `html` field name maps
to it. `ContentControls.tsx` renders it as a monospace, multiline
`<Textarea>` ("HTML" label) with a placeholder and helper text describing what is
allowed/stripped. Edits write straight to the node's `html` prop via the existing
`useUpdateProp` mechanism, so the canvas updates live.

## Tests

- `block-schema/src/__tests__/sanitize.test.ts`: allowlisted YouTube/Calendly/
  Vimeo iframes kept + sandboxed; non-allowlisted & `javascript:` iframes
  dropped; `<script>` stripped alongside a valid embed; event handlers and
  `allow-top-navigation` sandbox-escape stripped; safe formatting kept; nullish
  → "".
- `blocks/src/__tests__/render.test.tsx`: block-count bumped 31 → 32 + an `Embed`
  resolves test (isCanvas false, `defaultProps.html === ""`).
- The OB-homepage round-trip count (28) in `import-roundtrip.test.ts` is
  intentionally **left unchanged** — it counts block types present in that export,
  which does not include Embed.
