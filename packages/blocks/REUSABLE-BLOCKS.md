# Reusable / Global Synced Blocks (REUSE-BLOCKS)

A **reusable block** is a named, per-website fragment that pages **reference**
(not copy). Inserting it drops a single `ReusableBlock` node carrying a
`reusableBlockId`; at render time the block resolves the referenced layout and
renders it. Editing the source updates **every** instance — *edit once, update
everywhere*. This is distinct from **templates** (`page_templates`), which are
one-time **copies**.

The design mirrors two existing patterns: the **Form block** (a block that
resolves external data via a React context provided differently by renderer vs
admin) and **global chrome** (`site-chrome` — per-site stored `SerializedLayout`
+ admin builder + render injection).

---

## 1. Storage & API (`apps/api`)

### Schema — `reusable_blocks`
`apps/api/src/database/schema/reusable-blocks.schema.ts` (prefix `rub`):

| column   | notes                                              |
| -------- | -------------------------------------------------- |
| `siteId` | FK → `sites.id`, **NOT NULL** (tenant-private)     |
| `name`   | varchar(200)                                       |
| `layout` | jsonb `SerializedLayout` fragment (its own root)   |
| `createdBy` / base audit + soft-delete columns (`baseColumns`) |

Migration: `apps/api/src/database/migrations/0006_reusable_blocks.sql` (journal
entry `idx: 6`, tag `0006_reusable_blocks`). Exported from the schema barrel.

**Environment seed:** Office Beacon reusable blocks ship as committed fixtures in
`apps/api/src/database/seed/fixtures/officebeacon-reusable-blocks.json` (14 rows
exported from local `ob_cms.reusable_blocks`, preserving `rub_*` ids and audit
timestamps). They are inserted idempotently by `seedOfficeBeaconReusableBlocks()`,
which resolves the target site by **subdomain** (`officebeacon` via
`OB_SITE_SUBDOMAIN`) — never a hardcoded site UUID.

Commands:

- `bun run db:seed:reusable-blocks` — UAT-safe; only seeds reusable blocks
- `bun run db:seed` — full seed (includes reusables after site upsert)

Refresh fixtures from a local DB: `bun scripts/export-officebeacon-reusable-blocks.mjs`

### Module — `modules/reusable-blocks`
Registered in `app.module.ts`. Site-scoped via `X-Site-Id` + `ScopedRepository`;
`@Roles("editor")`; envelope via `responseUtils`; layouts validated/repaired
through `deserializeLayout()` (block-schema); audited (`reusable_block.created/
updated/deleted`).

**Authenticated (admin):**
- `GET  /api/v1/reusable-blocks` — list (`id, name, layout, …`)
- `POST /api/v1/reusable-blocks` — create `{ name, layout }`
- `GET  /api/v1/reusable-blocks/:id`
- `PUT  /api/v1/reusable-blocks/:id` — update `name`/`layout`
- `DELETE /api/v1/reusable-blocks/:id` — soft-delete

On `PUT`/`DELETE` we `enqueueCachePurge({ entity: "reusable-block", slug: "/" })`
so the renderer's `render:<siteId>:*` keys are swept and every instance
re-resolves (save = live).

**Public (renderer):**
- `GET /api/v1/public/reusable-blocks/:id` — `@Public`, **host-resolved** via
  `SiteResolver` (never trusts a client siteId). Returns `{ id, name, layout }`.

---

## 2. The reference block + resolver context (`packages/blocks`)

- **`reusable-context.tsx`** (`"use client"`): `ReusableBlockContext` with
  `{ getReusable(id): Promise<SerializedLayout | null> }`. Kept in its own
  `"use client"` module (like `form-context.tsx`) so `createContext` never lands
  in an RSC server module — `lib.tsx` stays free of `createContext`.
- **`blocks/reusable.tsx`** (`"use client"`): `ReusableBlock` — prop
  `{ reusableBlockId?: string }`. Reads the context → resolves the layout →
  renders `<RenderLayout data={migrate(layout)} blocks={blockRegistry}
  wrap={false} />`. SSR-safe (resolves only after `useMounted`). Unresolved/empty
  → placeholder ("Select a reusable block" / "Reusable block").
- Registered as **`"Reusable Block"`** in `blockRegistry` (registry.tsx) with a
  zod prop-schema `reusableBlockSchema` (`reusableBlockId?: string`) in
  block-schema's `blockPropSchemas`. Block + block-schema tests stay green
  (registry size 30; the homepage round-trip still exercises 28 types).

### Renderer (live resolver) — `apps/renderer`
- Proxy `app/api/reusable-blocks/[id]/route.ts` forwards the tenant Host to the
  API public endpoint (mirrors the forms proxy).
- `components/reusable-block-provider.tsx` — `LiveReusableBlockProvider`
  (`"use client"`); `getReusable(id)` fetches the same-origin proxy.
- Wired in `app/[[...slug]]/page.tsx` around the page render (outside
  `LiveFormProvider`).

### Admin (preview resolver) — `apps/admin`
- `views/builder/components/PreviewReusableBlockProvider.tsx` — provides the
  context fetching `GET /reusable-blocks/:id` via admin axios so canvas instances
  preview the real content. Mounted in `Canvas.tsx` around `PreviewFormProvider`.

---

## 3. Save-as-reusable, insert, edit/sync (`apps/admin`)

- **Save as reusable** — toolbar action in `PropertyPanel` opens
  `SaveReusableBlockDialog`. `nodeOps.subtreeToLayout(query, selectedId)`
  serializes the selected subtree into a self-contained `SerializedLayout`
  (root = selected node, parent nulled, migrated) → `POST /reusable-blocks`.
- **Insert** — the "Reusable" tab (`ReusableBlocksPanel` in `LeftSidebar`) lists
  the site's blocks; click/drag inserts a `ReusableBlock` reference
  (`reusableBlockId`) under `ROOT`. The canvas preview context resolves it.
- **Edit (sync)** — `/reusable/:id` mounts the same Editor+Canvas+PropertyPanel
  on the block's layout (`ReusableBlockEditor`), loaded via `GET /:id`, autosaved
  via `PUT /:id` (`useReusableBlockAutosave`). Saving purges the cache, so all
  references re-resolve on next render. A **Reusable Blocks** entry (AppShell SITE
  sidebar) opens the manager (`ReusableBlocks.tsx`) → edit/delete.

The `reusableBlockId` prop is hidden from the auto-generated property controls
(`introspect.ts`) since it's set by insertion, not free-text editing.
