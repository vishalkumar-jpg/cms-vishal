# CMS Shared Component Strategy

**PR 3 — shared component architecture.**  
**Source of truth:** [CMS Template Architecture](./template-architecture.md) (PR #2 / merged PR #16).  
**Downstream:** [Section Composition System](./section-composition.md) (PR #18); [Starter Page Templates](./starter-page-templates.md) (PR #19); [Platform operations & roadmap](./cms-operations.md).  
**Doc map:** [CMS docs README](./README.md).  
**Homepage:** already implemented as a full-layout preset; this PR must not change homepage rendering or page output.  
**Status:** strategy + typed family catalog foundation. No template engine, page-creation UX, DB, APIs, themes, localization, or collections.

---

## 0. Intent

Move authoring and engineering from **page-named component forks** to **shared component families with variants**:

```text
Avoid                         Prefer
─────────────────────         ──────────────────────────────
HomepageHero.tsx              Hero family
ServiceHero.tsx                 ├─ variant: homepage
CareerHero.tsx                  ├─ variant: service
LandingHero.tsx                 ├─ variant: industry
                                ├─ variant: career
                                └─ variant: landing
```

This PR establishes the contract and inventory so future templates (Service, Industry, LP, Careers, …) reuse one family per concern instead of duplicating UI.

---

## 1. Audit: current component landscape

### 1.1 Where things live today

| Layer | Location | Role today |
|-------|----------|------------|
| Block implementations | `packages/blocks` (`@ob-cms/blocks`) | Registry of renderable blocks (`Hero Section`, `Accordion`, …) |
| Prop schemas | `packages/block-schema` (`@ob-cms/block-schema`) | Zod contracts + layout serialization |
| Section starters | `apps/admin/.../sections/sectionPresets.ts` | Insert/copy presets (Hero, CTA, FAQ, Full Page, …) |
| Homepage | `obHomepage.json` via `ob-full-homepage` preset | Composed of primitives + composites—not a separate homepage package |
| Reusable Blocks | Existing CMS reusable-block + `ComponentDefinition.variants` | Synchronized fragments across pages |

### 1.2 Current problems

| Problem | Detail |
|---------|--------|
| **No typed family layer** | Doc-level families (PR #2 §4–§5) are not yet mapped in code as a stable catalog |
| **Overlapping “card” patterns** | `Card`, `Feature List`, `Article Card Grid`, card-grid presets solve similar jobs under different names |
| **Overlapping timelines** | `Timeline`, `Event Timeline`, and `Step Cards` cover related process/history needs |
| **FAQ naming drift** | Product language says FAQ; registry block is `Accordion`; preset is `faq-stacked` |
| **CTA is compositional** | CTA bands are mostly presets of text + buttons; `Floating CTA` is a separate block |
| **Variant vocabulary overload** | Button `variant`, experiment `variantKeys`, reusable-block prop variants, and PR #2 family variants are different concepts |
| **Composite vs primitives** | Homepage and many presets prefer editable primitives; composite blocks (`Hero Section`, …) hide structure until expand-to-builder |

### 1.3 What is *not* a problem (yet)

- **No `HomepageHero` / `ServiceHero` forks in code.** The anti-pattern exists only as a risk to avoid as templates expand.
- **Homepage full-layout preset works.** Do not refactor it in this PR.
- **Reusable Blocks already provide shared content sync** for testimonials/FAQs/chrome.

### 1.4 Reusable candidates vs page-specific

| Reusable (one family + variants) | Page- / content-specific (do not fork components) |
|----------------------------------|---------------------------------------------------|
| Hero, CTA band, Feature/Service/Industry/Resource cards | Page copy, media, SEO |
| Testimonials, FAQ, Team, Timeline, Forms, Logo cloud | Roles matrix item data; related link ID lists |
| Nav / Footer (prefer Reusable Block for sync) | Unique LP experiments (existing Experiment system) |

### 1.5 Missing shared primitives (documented gaps; not implemented here)

Per PR #2 §4.14–4.15 and §11: **Roles Matrix** and **Related Links** compositions for Service/Industry templates. Those land in a later composition/preset PR—not as page-named components, and not by changing homepage output in this PR.

---

## 2. Target component model

```text
Template (catalog)
  ↓ selects families + default variants
Sections (slots)
  ↓ bind to
Component family (registry + variants)     ← THIS PR’s focus
  ↓ instances become
Blocks (layout nodes)
  ↓ filled by
Content (page | content record | Reusable Block)
```

| Concept | Definition |
|---------|------------|
| **Component family** | One concern (Hero, CTA, Cards, …) with a shared configuration contract |
| **Variant** | Named presentation of that family (`homepage`, `service`, …)—not a separate component file |
| **Section preset** | Insert/copy starter that wires a family (+ optional Reusable Block refs) into a layout subtree |
| **Block instance** | Node in a page (or reusable) layout with prop values |

Typed catalog foundation: `@ob-cms/block-schema` → `component-families` (IDs, variants, config field lists, registry mapping). **Not wired into renderer or editor in this PR.**

---

## 3. Component families

Configuration fields below are the **contract**. Existing registry props may use different key names today (`ctaText` vs `buttons`); future alignment should extend the shared family, not fork it.

### 3.1 Hero

**Variants:** `homepage` · `service` · `industry` · `career` · `landing`

| Config | Notes |
|--------|-------|
| `title` | Required headline |
| `subtitle` | Optional supporting copy |
| `image` / media | Optional; layout-dependent |
| `background` | Optional styles / media |
| `ctaButtons` | Primary (+ optional secondary) |
| `alignment` | e.g. centered vs split (maps to today’s `layout`) |
| `visibility` | Section / device visibility |
| `variant` | Family variant id |

**Registry today:** `Hero Section` (`layout`: centered \| split). **Presets:** `hero-centered`, `hero-split`, `hero-with-form`.

### 3.2 CTA

**Variants:** `primary` · `banner` · `inline`

| Config | Notes |
|--------|-------|
| `title` | Optional band title |
| `description` | Optional supporting copy |
| `buttons` | CTA actions |
| `styleVariant` | Maps to family variant |
| `visibility` | Section visibility |

**Registry / presets today:** CTA presets (`cta-banner`, `cta-split`); `Floating CTA`; Button primitives.

### 3.3 Cards

**Variants:** `feature` · `service` · `industry` · `resource`

| Config | Notes |
|--------|-------|
| `title` | Card title |
| `description` | Blurb |
| `image` | Optional |
| `link` | Optional URL / route |
| `metadata` | Optional badges, tags, etc. |

**Registry today:** `Feature List`, `Card`, `Article Card Grid`, card-grid / blog presets. Prefer **one Cards family + variants** over new `ServiceCardGrid.tsx` forks.

### 3.4 Testimonials

| Config | Notes |
|--------|-------|
| `quote` | Quote text (or video ref) |
| `author` | Name |
| `role` | Title |
| `company` | Org |
| `image` | Avatar / poster |

**Prefer Reusable Block** when the same group appears on many pages. **Registry today:** `Video Testimonial Carousel`; quote-grid presets.

### 3.5 FAQ

| Config | Notes |
|--------|-------|
| `question` | Q |
| `answer` | A |
| `ordering` | Page or block item order |
| `visibility` | Hide empty / optional section |

**Prefer Reusable Block** for shared FAQ groups. **Registry today:** `Accordion`; preset `faq-stacked`.

### 3.6 Team

| Config | Notes |
|--------|-------|
| `memberName` | Display name |
| `role` | Title |
| `image` | Photo |
| `description` | Bio / region notes |

**Registry today:** `Team Grid`; preset `team-grid`.

### 3.7 Timeline

| Config | Notes |
|--------|-------|
| `date` | Year / date label |
| `title` | Milestone title |
| `description` | Detail |

**Registry today:** `Timeline`, `Event Timeline`, `Step Cards`; preset `timeline-steps`. Consolidate via **variants**, not three forever-forked product components.

### 3.8 Forms

| Config | Notes |
|--------|-------|
| `fieldsReference` | Form id / field binding to existing forms system |
| `cta` | Submit label / adjacent CTA |
| `successState` | Success message / redirect |
| `visibility` | Section visibility |

**Registry today:** `Form`, `Stepper Form`, `Newsletter`; contact presets. Do not invent a parallel forms runtime in this PR.

### 3.9 Additional families (from PR #2; cataloged for completeness)

Logo cloud, Rich content, Navigation, Footer, Roles matrix, Related links—see [template-architecture.md §4](./template-architecture.md). Roles / Related remain **documented gaps** until a composition PR.

---

## 4. Component ownership model

Avoid duplicate sources of truth (aligned with PR #2 §7).

| Owner | Owns |
|-------|------|
| **Components** (`@ob-cms/blocks` + schemas) | Rendering behavior; supported variants; configuration contract (props) |
| **Templates** | Which families/sections appear; default variants and placeholders; required vs optional slots |
| **Pages** | Content values (ordinary pages); section ordering; visibility; page-local overrides |
| **Content records** | Body/media for collection-backed detail templates (PR #2 §1.2.1) |
| **Reusable Blocks** | Synchronized fragment content when intentionally shared |

```text
Components  →  how it renders + which variants exist
Templates   →  which components compose the page skeleton
Pages       →  what the content says + which optional bits show
```

---

## 5. Variant strategy

### 5.1 How variants work

```text
Hero.tsx / Hero Section (one family)
  variant="homepage" | "service" | "industry" | "career" | "landing"
```

Not:

```text
ServiceHero.tsx
CareerHero.tsx
```

Today’s interim mapping:

| Mechanism | Use for |
|-----------|---------|
| Family `variant` (this catalog) | Product-level presentation of a section family |
| Block prop e.g. Hero `layout` | Low-level layout knob inside the family |
| Section preset id | Insert/copy starter that picks a family + defaults |
| Reusable Block `ComponentDefinition.variants` | Prop presets on **shared** synchronized content |
| Experiment `variantKeys` | A/B testing—orthogonal to marketing family variants |

### 5.2 When to create a variant

- Same semantic section, different **layout emphasis** or chrome density (e.g. LP form-forward hero).
- Shared prop contract still applies; only defaults / arrangement differ.
- Multiple templates need the same concern with different presentation.

### 5.3 When *not* to create a new component

- Only the **copy** differs → page content.
- Only the **shared quote list** differs across sites → Reusable Block.
- Only **one prop** flips (centered vs split) → existing prop or a variant, not `HeroCentered.tsx`.
- A one-off campaign layout → page composition or Experiment, not a forever registry fork.

### 5.4 Avoiding component explosion

1. Search the family catalog before adding a registry entry.
2. Prefer **variant** → then **section preset** → then **new family** (rare).
3. Never name components after routes or page types (`AboutHero`, `BlogDetailCTA`).
4. De-dupe overlapping blocks (`Timeline` / `Event Timeline` / `Step Cards`) by documenting variant intent before adding a fourth.

---

## 6. Reusable Block strategy (aligned with PR #2)

| Kind | Behavior |
|------|----------|
| **Reusable Blocks** | Shared across pages; intentional updates **propagate** to referencing pages |
| **Page sections** | Layout copied after template creation; customized per page; template edits do **not** silently overwrite |

**Good Reusable Block examples:** testimonial groups, FAQ groups, feature groups used site-wide, logo clouds, nav/footer chrome.

**Keep page-local when:** content is unique to one URL (service hero title, page-specific CTA copy, roles matrix for one service).

Do not use Reusable Blocks as a substitute for component families—families are **rendering + contract**; Reusable Blocks are **shared content instances**.

---

## 7. Migration approach

| Phase | Action | This PR? |
|-------|--------|----------|
| **A. Document + catalog** | Inventory registry → families; define variants & ownership | **Yes** |
| **B. Typed foundation** | Export family/variant IDs + config field lists from `@ob-cms/block-schema` | **Yes** (unused by renderer) |
| **C. Safe presets / compositions** | Roles Matrix, Related Links, service/industry hero presets | Later implementation PR; **composition rules** in [section-composition.md](./section-composition.md) (PR #18) |
| **D. Align prop names** | Gradually normalize Hero/CTA props toward family contracts | Later, non-breaking |
| **E. Template catalog wiring** | Choose Template → generate sections | Later PR (page creation) |
| **F. Homepage** | Leave existing preset/output alone | **Out of scope forever for “fix homepage” unless a dedicated PR** |

**Migration rule:** existing pages and the homepage keep working byte-identically. New work adopts families; old layouts are not force-migrated.

---

## 8. Minimal implementation in this PR

| Included | Excluded |
|----------|----------|
| `docs/cms/shared-component-strategy.md` | Template engine / page creation flow |
| `packages/block-schema/src/component-families.ts` (+ tests, export) | New UI, homepage JSON edits, editor UX |
| Pointer from template architecture §11 | DB, APIs, themes, localization, collections |
| `packages/blocks/src/families/README.md` (org note) | New dependencies; `ServiceHero`-style files |

---

## 9. Non-goals (this PR)

- Runtime rendering changes
- Builder/editor behavior changes
- Database schemas or APIs
- Publishing, localization, themes, collections
- Redesigning existing page visuals
- Implementing Service/Industry templates end-to-end

---

## 10. Traceability

| Source | This document |
|--------|----------------|
| PR #2 §5 Shared component strategy | §2–§5 |
| PR #2 §4 Section families | §3 |
| PR #2 §7 Ownership | §4 |
| PR #2 §1.6 / Reusable Blocks | §6 |
| PR #2 §11 PR #3 checklist items 1–2 | Inventory + variants (items 3–5 deferred) |
| PR #18 Section Composition | Sections bind to these families; see [section-composition.md](./section-composition.md) |
| PR #19 Starter Page Templates | Per-template recommended variants; see [starter-page-templates.md](./starter-page-templates.md) |
| Platform operations | Registry / create flow / roadmap; see [cms-operations.md](./cms-operations.md) |

Typed catalog: `packages/block-schema/src/component-families.ts`.
