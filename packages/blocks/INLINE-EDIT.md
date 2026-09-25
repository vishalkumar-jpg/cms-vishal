# Inline rich-text editing (builder canvas)

Marketers can double-click / click into a selected text block on the page-builder
canvas and edit it in place. Edits commit to the block's props (Craft `setProp`),
which drives autosave and is mirrored by the side property panel. The public
renderer is unaffected: it emits the same static, sanitized HTML as before.

## `BlockEditingContext` (`src/lib.tsx`)

```ts
interface BlockEditingContextValue {
  editing: boolean;                               // node is selected in builder
  commit: (propKey: string, value: string) => void; // write plain text -> prop
}
const BlockEditingContext = React.createContext<BlockEditingContextValue | null>(null);
```

- Default is `null`. **The renderer never provides it**, so every `EditableText`
  takes the static branch — identical output to before this feature.
- The admin builder provides it from `createCraftBlock` (see below).

## `EditableText` (`src/lib.tsx`)

```tsx
<EditableText
  value?      // raw prop value
  propKey     // which prop commit() writes (e.g. "text", "title", "label")
  as?         // intrinsic tag to render (default: React.Fragment, i.e. inline)
  className?  style?
  highlightText?  highlightColor?   // highlight-aware static rendering
/>
```

Behavior:

- **Not editing / no context (renderer, static):** renders sanitized text via
  `HighlightedText` when `highlightText`/`highlightColor` are set, else
  `sanitizeText(value)`. No `contentEditable` attribute is emitted.
- **Editing (`ctx.editing === true`):** renders `<as contentEditable
  suppressContentEditableWarning>` showing the **raw** value.
  - **Uncontrolled**: initial text is written to the element via a `ref` on mount
    and re-seeded only when `value` changes from the outside (e.g. side panel).
    React never re-renders the element from `value` while typing → **no cursor
    jumps**.
  - **Commit on blur**: reads `e.currentTarget.textContent` and calls
    `commit(propKey, text)` (only when changed).
  - `cursor: text` + no default outline; `onMouseDown`/key events `stopPropagation`
    so focusing doesn't fight Craft drag and **editor shortcuts (undo/redo/copy)
    don't hijack typing**.

The two modes are split into internal `StaticText` / `EditingText` components so
the Rules of Hooks hold (the editing-only `useRef`/`useEffect` never run on the
static SSR path).

## `createCraftBlock` wiring (`apps/admin/.../craft/createCraftBlock.tsx`)

- Pulls `actions.setProp` from `useNode(...)` alongside the existing
  `connect`/`drag`/`selected`/`hovered`.
- Wraps the rendered `<Shared>` in
  `<BlockEditingContext.Provider value={{ editing: selected, commit }}>` where
  `commit(key, val) => setProp(p => { p[key] = val; })`.
- So a block's text is editable exactly when its node is **selected**; clicking
  selects the node, then the text is focusable/editable. `setProp` triggers
  autosave and the side panel reflects the same value.

## Blocks made editable (which `propKey`)

| Block            | File             | Editable prop(s)        |
|------------------|------------------|-------------------------|
| Heading          | `content.tsx`    | `text` (+highlight)     |
| Paragraph        | `content.tsx`    | `text` (+highlight)     |
| SectionHeading   | `content.tsx`    | `title` (+highlight), `subtitle` (eyebrow) |
| Button           | `content.tsx`    | `label`                 |
| Link             | `content.tsx`    | `text`                  |
| Copyright Block  | `footer.tsx`     | `text`                  |
| Topbar           | `navigation.tsx` | `text`                  |
| Hero Section     | `marketing.tsx`  | `title` (+highlight), `subtitle` |

`HighlightedText` remains exported and is used by `EditableText`'s static branch
(and is still available directly).

## Caveats

- contentEditable plain-text only: rich formatting is intentionally not captured;
  `textContent` is committed and re-sanitized on static render.
- For blocks whose forwardRef root is the text element itself (Copyright, Topbar,
  Button label, Link), the editable surface is an inner `span`/element so it
  doesn't collide with the Craft connector ref on the root.
