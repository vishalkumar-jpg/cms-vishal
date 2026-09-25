# Data Binding — Repeater, Prop Bindings & Conditional Visibility

This turns the OB-CMS page builder from static-only into **dynamic**: loop a
block-tree template over a collection (Repeater), bind any block prop to a
collection field, and conditionally show/hide nodes. It is built ON TOP OF the
existing dynamic-collections plumbing — no new data path was added.

## Reuses the collections plumbing

The Repeater resolves items through the SAME `CollectionRenderContext.getItems(
collectionSlug, { limit, sort })` the `Collection List` block uses. Both
providers are reused unchanged:

- **Renderer**: `LiveCollectionProvider` → `GET /api/collections/:slug/items`
  (same-origin proxy → host-resolved public API).
- **Editor**: `PreviewCollectionProvider` → admin axios (site-scoped). The
  Repeater's `collectionSlug` prop is wired to the existing `CollectionPickerField`
  (introspect maps `collectionSlug` → the `"collection"` control). Field keys for
  binding come from `useCollections()` (`collection.fields[].key`).

## `RepeaterItemContext` (use client)

`packages/blocks/src/repeater-context.tsx` — a React context carrying the CURRENT
item's `{ data, index, count, id, slug }`. The Repeater provides it (once per
published item in the renderer, once with a sample/first item in the editor);
descendants read it for bindings. `useBoundProp(propPath, staticValue)` resolves
a single prop against the current item + the node's `bindings`; `NodeBindingContext`
carries the current node's bindings to its own block (editor parity).

## Repeater render model

`packages/blocks/src/blocks/repeater.tsx` — a CANVAS block (`isCanvas: true`)
whose children form the per-item template subtree. Two modes, ONE component
(editor↔renderer parity):

- **Renderer**: the shared, pure, RSC-safe walker `renderNode` (in
  `render-layout.tsx`) injects the SERIALIZABLE node map + template child ids +
  env as `__data` / `__templateIds` / `__env` (plain JSON only — the client
  Repeater imports `blockRegistry` itself, so nothing un-serializable crosses the
  RSC→client boundary). The Repeater re-enters the SAME walker via
  `renderSubtree(...)` once per item, each wrapped in its `RepeaterItemContext`.
- **Editor**: no `__data` injected → the Repeater renders its Craft `children`
  ONCE (the authoring instance) wrapped in a sample item, plus a "Repeats × N"
  affordance. The author edits a SINGLE template.

SSR-safe: items resolve after mount (`useMounted`), exactly like Collection List.

## Bindings shape + resolution

A node carries `bindings?: Record<propPath, fieldKey>` (`packages/block-schema/
src/binding.ts`, added to `blockNodeSchema`). Resolution (pure, unit-tested):

- `resolveBinding(staticValue, propPath, bindings, item)` → `item[fieldKey]` when
  bound + present, else the static value (fallback outside a repeater / missing).
- `applyBindings(props, bindings, item)` → new props with bound props overridden;
  IDENTITY when there are no bindings / no item (backward-compatible).

The renderer's `renderNode` pre-resolves props via `applyBindings`. The common
content blocks (Heading `text`, Paragraph `text`, Image `imageUrl`/`altText`,
Button `label`/`url`, Link `text`/`url`) also call `useBoundProp` so the EDITOR
(Craft renders them directly, not via `renderNode`) resolves identically.

Admin: a "⛓ bind" toggle (`FieldBindControl`) appears on bindable props when the
node is inside a Repeater → pick a field → stored on `bindings[propPath]`.

## `visibleIf` shape + resolution

`visibleIf?: { type: "always"|"locale"|"authenticated"|"field", op?, value?, field? }`.
`evaluateVisibleIf(visibleIf, { locale, authenticated, item })`:

- `locale` — compares the active render locale (reuses the i18n locale already
  plumbed; the renderer passes `env={{ locale }}`).
- `authenticated` — visitor-session SEAM; defaults to `true` until visitor auth
  is plumbed.
- `field` — within a repeater, compares `item[field]` (`eq`/`neq`/`truthy`/`falsy`).

The renderer REMOVES a node whose condition fails. The editor never truly hides
(authors must still select+edit) — it dims the node + paints a "hidden" badge.
Admin: a `VisibilityControl` in the Content tab sets it.

## Persistence

The editor stores `bindings`/`visibleIf` in Craft `custom` (the only arbitrary
node field Craft serializes); `craft/serialize.ts` hoists them to top-level
`node.bindings`/`node.visibleIf` on save and mirrors them back into `custom` on
load. The renderer reads the top-level fields. Nodes without these emit nothing
and render byte-identically to before.

## Parity & backward-compat

One walker (`renderNode`/`renderSubtree`), one set of pure resolvers, used by
both the renderer and (via `useBoundProp` + the editor sample item) the builder.
Blocks without bindings/repeater/visibleIf are untouched: `applyBindings` is an
identity, `evaluateVisibleIf(undefined)` is `true`, and no extra markup is
emitted.
