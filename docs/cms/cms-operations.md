# CMS Platform Operations & Roadmap

**Final architecture documentation PR — Markdown only.**  
**Completes remaining platform topics** before runtime implementation. Does **not** redesign PR #15–#19.

**Sources of truth (do not duplicate):**

| Topic | Document |
|-------|----------|
| Live-site audit & gaps | [OB Live audit](../ob-live/website-audit-and-cms-gap-analysis.md) (PR #15) |
| Template vs page, ownership | [Template architecture](./template-architecture.md) (PR #16) |
| Component families & variants | [Shared component strategy](./shared-component-strategy.md) (PR #17) |
| Section composition | [Section composition](./section-composition.md) (PR #18) |
| Starter catalog & kits (content) | [Starter page templates](./starter-page-templates.md) (PR #19) |
| Doc map | [CMS docs README](./README.md) |

**Status:** architectural contracts for registry, lifecycle, versioning, page creation, management, themes, localization, and runtime phasing. AI is documented only as a **future enhancement** (out of current scope). **No** runtime, APIs, DB schemas, editor UI, or package changes in this PR.

---

## 0. Intent

PR #15–#19 define **what** templates, sections, and components are. This document defines **how the platform operates** them (registry, states, versions, create flows, kits as products, themes/i18n) and the **implementation order** after documentation is complete. AI is a deferred future enhancement (§9)—not part of the current runtime roadmap.

```text
Catalog & kits (PR #19)
  ↓ managed by
Registry + lifecycle + versioning (this doc)
  ↓ used by
Create Website / Create Page flows (this doc)
  ↓ styled / localized later by
Theme + Localization layers (this doc — future)
```

---

## 1. Template registry

The **template registry** is the product catalog of starter templates (and, later, kits). Wave 1 templates remain **insert/copy starters**—not route-bound page types ([template architecture](./template-architecture.md) §1; [starters](./starter-page-templates.md) §1).

**Runtime (Phase 1):** `@ob-cms/template-registry` provides an in-memory registry for metadata, registration, lookup, and filtering. It does **not** yet persist, create pages, or store layout JSON.

### 1.1 Registry entry

Every registry entry exposes at least the metadata in [starter-page-templates.md §2](./starter-page-templates.md):

| Field | Role in registry |
|-------|------------------|
| **Template ID** | Stable key (`tpl-service-detail`, …) |
| **Display Name** | UI label |
| **Category** | Marketing · Content · Legal · Utility · Campaign |
| **Version** | Semver-like opaque revision of the **published** skeleton |
| **Status** | `draft` · `published` · `archived` (deprecated may map to archived) |
| **Tags** | Search/filter facets |
| **Description** | Short blurb |
| **Supported page types** | Logical tags (not URL binding in wave 1) |
| **Default thumbnail** | Media ref (concept until registry implementation) |
| **Featured** | Boolean / rank for “featured templates” shelf |
| **Owner** | Platform or site-admin principal that maintains the definition |
| **Permissions** | Who may view / create-from / edit / publish / archive (see §6) |

IDs and categories for the initial 16 starters: see [starter catalog §4](./starter-page-templates.md).

### 1.2 Search & filtering

Operators discover templates via:

| Mechanism | Examples |
|-----------|----------|
| **Search** | Display name, description, tags, template ID |
| **Filter** | Category, status (`published` for create), tags, featured |
| **Sort** | Featured rank, name, recently updated |

Create Page / Choose Template lists **published** entries only (by default). Admins may browse draft/archived in management UI (future).

### 1.3 Featured templates

Featured flag surfaces a short list (e.g. Homepage, Service Detail, Landing, Contact) without changing copy-on-create semantics.

### 1.4 Ownership & permissions (registry)

| Role (conceptual) | Capabilities |
|-------------------|--------------|
| **Platform admin** | Create/edit/publish/archive global catalog templates; manage featured |
| **Site admin** | Create pages from published templates; manage site Reusable Blocks; optional site-scoped template forks later |
| **Editor** | Create/edit/publish **pages**; cannot mutate global template definitions |
| **Viewer** | Preview published pages |

Exact RBAC is implementation detail; do not invent APIs here.

---

## 2. Template lifecycle

```text
Create
  ↓
Draft
  ↓
Review (optional gate)
  ↓
Publish
  ↓
Archive
  ↓
Restore → Draft or Publish
  ↓
Delete (future)
```

| State | Meaning |
|-------|---------|
| **Create** | New catalog entry; not selectable for page creation |
| **Draft** | Editable definition; **not** offered in Choose Template (or marked experimental) |
| **Review** | Optional approval gate before publish (process, not a required product feature in wave 1) |
| **Publish** | Becomes **latest published** version; available for Create Page / kits |
| **Archive** | Hidden from default create lists; existing pages **unchanged**; retained for history |
| **Restore** | Bring archived entry back to Draft (then re-publish) or directly to Publish per policy |
| **Delete (future)** | Hard remove only when no historical need; prefer Archive. Not required for first runtime phases |

**Invariant:** lifecycle transitions on a template **never** rewrite existing page layouts ([§3](#3-template-versioning); PR #16 §1.6).

---

## 3. Template versioning

Aligned with [template architecture §1.6](./template-architecture.md) and [starters §1](./starter-page-templates.md).

| Concern | Rule |
|---------|------|
| **Version numbering** | Each publish bumps an opaque version (recommend semver: major = breaking skeleton, minor = additive optional sections, patch = copy/defaults) |
| **Published versions** | Immutable snapshots once published; “latest published” is what Create Page resolves |
| **Draft versions** | Work-in-progress next skeleton; invisible to create-from-template until published |
| **Copy-on-create** | Page receives a **copy** of the chosen published snapshot (sections, defaults, placeholder refs) |
| **Existing pages** | **Never** auto-update when a new template version is published |
| **New pages** | Always use the **latest published** version of the selected template ID |
| **Future compare/update** | Optional manual “compare page ↔ template version / re-apply skeleton” — **opt-in, never silent overwrite** |

Reusable Blocks referenced by slots still update in place when the shared block changes (intentional sync)—that is **not** a template version bump rewriting pages.

---

## 4. Page creation flow

Extends [template architecture §6](./template-architecture.md) and [section composition](./section-composition.md) without changing ownership.

### 4.1 Primary journey (website → page)

```text
Create Website
  ↓
Choose Starter Kit (optional)
  ↓
Choose Template
  ↓
Copy Template (latest published snapshot)
  ↓
Create Page (independent instance)
  ↓
Edit (content, optional sections, order, SEO)
  ↓
Preview
  ↓
Publish
```

| Step | Notes |
|------|-------|
| **Create Website** | Site + chrome Reusable Blocks + optional theme binding (theme engine later—§7) |
| **Choose Starter Kit** | Optional; suggests templates/nav/blocks ([kits](./starter-page-templates.md) §5; kit product rules §5 below) |
| **Choose Template** | From registry published list |
| **Copy Template** | Layout copy; page is independent afterward |
| **Edit / Preview / Publish** | Page lifecycle ([starters §1.1](./starter-page-templates.md)) |

### 4.2 Related page actions

| Action | Behavior |
|--------|----------|
| **Clone Page** | Create-from-**template** again (fresh placeholders)—same as Choose Template |
| **Duplicate Page** | Copy an **existing page** (layout + content) → new draft; still independent |
| **Save as Template (future)** | Promote a page skeleton to a new draft catalog entry; does not mutate the source page; requires permissions |

---

## 5. Website starter kits (platform view)

**Catalog content** (which templates each kit includes) lives in [starter-page-templates.md §5](./starter-page-templates.md). This section defines the **kit as a platform object**.

### 5.1 Kit structure

| Field | Meaning |
|-------|---------|
| **Kit ID** | Stable id (e.g. `kit-corporate`) |
| **Display name / description** | Marketing label |
| **Included template IDs** | Ordered list of `tpl-*` refs (published only at apply-time) |
| **Suggested navigation** | IA outline for chrome Reusable Block |
| **Suggested reusable blocks** | Default shared fragments (Nav, Footer, Testimonials, FAQ, …) |
| **Suggested theme** | Theme id or token pack hint (§7)—not enforced until theme engine |
| **Status / version** | Same lifecycle ideas as templates (draft/published/archived) |

### 5.2 Apply behavior (future runtime)

1. Resolve each included template’s **latest published** version.  
2. Optionally create draft pages (or leave “create later” checklist).  
3. Seed suggested Reusable Blocks if missing.  
4. Bind suggested theme if theme engine exists.  
5. **Never** overwrite existing pages silently when a kit is re-applied.

### 5.3 Future customization

- Site admins override nav/theme after apply.  
- Kits may add optional template IDs without breaking prior applies.  
- Industry packs = kits that emphasize Service/Industry Detail ([starters §6](./starter-page-templates.md)).

---

## 6. Template management

Admin operations on registry entries (conceptual):

| Action | Effect |
|--------|--------|
| **Create** | New draft entry |
| **Edit** | Change draft (or create new draft version from published) |
| **Publish** | Promote to latest published; Create Page can select it |
| **Archive** | Remove from default create lists; keep history |
| **Duplicate** | Copy definition → new draft ID (or same ID new draft version—product choice) |
| **Clone** | Same as Duplicate for definitions; for pages see §4.2 |
| **Version** | Explicit bump / history browse |
| **Delete (future)** | Prefer Archive; hard delete only with safeguards |
| **Permissions** | Gated by roles in §1.4 |

Page management (Draft / Publish / Archive / Duplicate / Clone) remains as in [starters §1.1](./starter-page-templates.md)—do not conflate **page** Archive with **template** Archive.

---

## 7. Theme support (future architecture)

**No implementation in this PR.** Themes skin presentation; they do **not** fork templates or components.

```text
Global Theme (platform defaults)
  ↓ overridden by
Website Theme (site binding)
  ↓ overridden by
Page Overrides (optional)
  ↓ overridden by
Section Overrides (spacing/background/etc. — PR #18 §5)
```

| Layer | Owns |
|-------|------|
| **Global Theme** | Default tokens (color, type, radius) for the platform |
| **Website Theme** | Site-selected pack; applies to all pages unless overridden |
| **Page Overrides** | Rare per-page token tweaks |
| **Section Overrides** | Band-level presentation already in section config (PR #18) |

Templates stay **structure-only**; components honor tokens ([template architecture §8](./template-architecture.md)).

---

## 8. Localization (future architecture)

**No implementation in this PR.** Structure stays shared; content varies by locale.

| Layer | Expectation |
|-------|-------------|
| **Website language** | Default locale(s) for the site |
| **Page language** | Page (or locale variant) content + SEO |
| **Template translation** | Template **skeletons** are locale-agnostic; labels/placeholders may have locale packs later—do not fork `tpl-service-detail-en` vs `-fr` as separate families in wave 1 |
| **Multilingual support** | Prefer locale fields or parallel page variants; Reusable Blocks per locale **or** keyed fields—decide in Localization phase |

Collection-backed body ownership (PR #16 §1.2.1) still holds: content record owns body per locale record as needed.

---

## 9. Future Enhancements (Out of Current Scope)

### 9.1 AI (intentionally deferred)

**AI is intentionally deferred.** It is **not** part of the current implementation / runtime roadmap (§10).

The current architecture (standardized templates, section families, component families, ownership rules) is designed so AI can be added **later without redesign**. Until then, treat the following as vision only—**no product commitment and no implementation phase**.

| Capability | How current standards enable it later |
|------------|----------------------------------------|
| **AI page generation** | Choose template ID + fill known section contracts instead of freeform HTML |
| **AI section generation** | Emit section family + variant + props matching PR #17/#18 contracts |
| **AI content suggestions** | Propose copy/media for page-owned fields; respect Reusable Block vs page vs content-record ownership |
| **AI template recommendations** | Suggest registry template IDs / kits from site intent or content |
| **AI layout optimization** | Propose section order/visibility within template-allowed rules (PR #18)—never silent overwrite of published pages |

**Guards (when AI is eventually considered):** never auto-publish; never silently rewrite templates or other pages; editors confirm output; required-section validation still applies (PR #18 §2.6).

---

## 10. Runtime roadmap

Documentation (PR #15–#19 + this doc) is complete for architecture. Suggested **implementation order** (AI excluded—see §9):

| Phase | Focus | Builds on |
|-------|--------|-----------|
| **Phase 1 — Template Registry** | Template catalog, metadata, registration, lookup, filtering, persistence foundation | This doc §1; starters §2–4 |
| **Phase 2 — Create Website & Create Page Flow** | Create Website → optional kit → choose template → copy → edit → preview → publish | This doc §4–5; template arch §6 |
| **Phase 3 — Reusable Blocks** | Wire starter defaults (Nav/Footer/Testimonials/FAQ); ensure sync semantics stay correct | PR #17/#19 defaults |
| **Phase 4 — Theme Engine** | Global / website / page overrides | This doc §7 |
| **Phase 5 — Localization** | Website/page locales; content-record locales | This doc §8 |
| **Phase 6 — Cloudflare Integration** | Deploy/runtime platform concerns (existing Cloudflare work continues in parallel as needed) | Platform ops |

Phases may overlap slightly (e.g. Reusable Block wiring during Create Page), but **registry + copy-on-create invariants** land before theme/i18n.

**Homepage:** existing full-layout preset remains; do not break it while adding registry/create flows.

---

## 11. Cross-document consistency

### 11.1 Naming

| Prefer | Avoid |
|--------|--------|
| Template (catalog starter) | Route-bound “page type” in wave 1 |
| Section family + component family + variant | `HomepageHero` / `ServiceHero` forks |
| Copy-on-create / independent page | Live-linked template instances |
| Reusable Block (shared content sync) | Duplicating shared FAQ/testimonials as page JSON long-term |
| Archive template vs archive page | Using one word for both without context |

### 11.2 Single sources (no duplicate catalogs)

| Concept | Canonical doc |
|---------|----------------|
| Template/page ownership & versioning invariants | `template-architecture.md` |
| Component families | `shared-component-strategy.md` + `component-families` types |
| Section rules & assemblies | `section-composition.md` |
| Per-template section lists & kit **contents** | `starter-page-templates.md` |
| Registry, lifecycle detail, create-website flow, themes/i18n, roadmap | **This document** |
| AI (future vision only) | This document §9 — **not** in runtime phases |

### 11.3 Invariants restated (must not conflict)

1. Pages are created by **copying** a published template.  
2. After creation, pages are **independent**.  
3. Template publish **never** auto-updates existing pages.  
4. New pages use **latest published** template version.  
5. Future compare/update is **manual / opt-in**.  
6. Empty **optional** sections may hide; **required** empties must not silently disappear.  
7. Collection-backed detail: content record owns body/media; page owns layout/SEO.

---

## 12. Non-goals (this PR)

- Runtime rendering, editor UI, drag & drop  
- Database schemas, APIs, template storage code  
- Theme engine, localization runtime  
- AI features (deferred; see §9 — out of current scope)  
- Package / lockfile / TypeScript changes  
- Homepage behavior changes  

**Documentation only.**

---

## 13. Traceability

| Topic | Section |
|-------|---------|
| Template registry | §1 |
| Lifecycle states | §2 |
| Versioning | §3 |
| Page creation flow | §4 |
| Starter kits (platform) | §5 |
| Template management | §6 |
| Themes | §7 |
| Localization | §8 |
| Future enhancements (AI — out of scope) | §9 |
| Runtime roadmap | §10 |
| Cross-doc review | §11 |
