# CMS Section Composition System

**PR 18 — section composition architecture / documentation only.**  
**Sources of truth:**

- [OB Live Website Audit & CMS Gap Analysis](../ob-live/website-audit-and-cms-gap-analysis.md) (PR #15)
- [CMS Template Architecture](./template-architecture.md) (PR #16)
- [CMS Shared Component Strategy](./shared-component-strategy.md) (PR #17)

**Homepage:** already implemented; this document must not imply changing existing homepage application code.  
**Status:** architectural contract for how **reusable sections** are composed from **component families**. No runtime, editor, API, or template-engine implementation in this PR.  
**Downstream:** [Starter Page Templates](./starter-page-templates.md) (PR #19); [Platform operations & roadmap](./cms-operations.md).  
**Doc map:** [CMS docs README](./README.md).

This document **does not redesign** PR #16 / #17. It deepens the **Section** layer those documents already define.

---

## 0. Intent

Today, pages are often assembled ad hoc from blocks and presets. After templates (PR #16) and component families (PR #17), pages need a stable rule for **which sections exist**, **how they compose**, and **what they may contain**.

```text
Template (catalog skeleton)
  ↓ selects and orders
Sections (logical bands + contracts)     ← THIS PR’s focus
  ↓ bind to
Component families + variants (PR #17)
  ↓ instantiate as
Blocks (layout nodes)
  ↓ filled by
Content (page | content record | Reusable Block)
```

**Section Composition System** = the rules, families, configuration contracts, and page-assembly patterns that let templates stay thin and pages stay consistent without forking components.

---

## 1. Section definition

### 1.1 What is a Section?

A **Section** is a **logical page band**—a named composition unit with a purpose (Hero, FAQ, CTA, …). It maps to one or more block subtrees in the serialized layout and binds to one primary **component family** (PR #17), optionally plus supporting primitives (buttons, headings, spacing wrappers).

| Aspect | Definition |
|--------|------------|
| **Purpose** | Express one job on the page (introduce, prove, convert, answer, relate, …) |
| **Granularity** | Larger than a single block prop; smaller than a full page or template |
| **Artifact today** | Closest live analog: Section Library **presets** (`sectionPresets`) and composed bands inside full-layout JSON |
| **Artifact next** | Named section family + variant + config, selected by templates and customized on pages |

### 1.2 How a Section differs from other layers

| Concept | Is | Is not |
|---------|----|--------|
| **Template** | Full-page starter: which sections, defaults, required vs optional | A single band; not live URL content |
| **Section** | One band with purpose, config, and allowed components | The whole page; not the React component implementation |
| **Component family** | Shared rendering + prop contract + variants (Hero, Cards, …) | Page structure or ordered layout |
| **Block** | Concrete node in `SerializedLayout` | The product-level section family name |
| **Page** | Published/draft instance with slug, SEO, content, section enablement/order | A reusable starter definition |
| **Reusable Block** | Synchronized **content** fragment referenced by a section slot | A substitute for a section family |

### 1.3 Ownership

Aligned with PR #16 §7 and PR #17 §4:

| Asset | Owner | Notes |
|-------|--------|------|
| **Section family definition** | Engineering / platform (catalog) | Purpose, allowed components, variants, config contract |
| **Section defaults in a template** | Template catalog | Default order, required/optional, default variants |
| **Section instance on a page** | **Page** | Enablement, order, visibility, spacing/background overrides, filled content (or refs) |
| **Component rendering** | `@ob-cms/blocks` + schemas | Variants and prop contracts |
| **Shared slot content** | **Reusable Block** when intentionally shared | Testimonials, FAQ groups, chrome |
| **Collection body/media** | **Content record** (PR #16 §1.2.1) | Blog/Resource detail rich content |

**Rule:** Templates own *which sections are offered*; pages own *whether and how they appear*; components own *how they render*; Reusable Blocks own *shared content sync*.

---

## 2. Section composition hierarchy

```text
Website
  ↓
Pages
  ↓
Sections
  ↓
Components (families + variants)
  ↓
Blocks (layout nodes)
  ↓
Editable Content
```

| Layer | Role in composition |
|-------|---------------------|
| **Website** | Site chrome, theme tokens, shared Reusable Blocks (nav/footer, global testimonials) |
| **Pages** | Route/slug instances; hold section order, visibility, page-local content |
| **Sections** | Ordered bands composing the page narrative |
| **Components** | Family implementations selected by each section |
| **Blocks** | Serialized tree nodes editors manipulate |
| **Editable content** | Props, media, relationship IDs, Reusable Block refs, collection fields |

### 2.1 Required sections

Every marketing page template includes the sections below.

**Reduced chrome** (Landing Page exception) applies **only** to **Navigation / Topbar** and **Footer**. It does **not** waive **Primary Hero** or **SEO metadata**—those remain required.

| Section | Purpose |
|---------|---------|
| **Navigation / Topbar** | Document chrome (prefer Reusable Block); optional only under reduced chrome |
| **Primary Hero** | Above-the-fold value prop + primary CTA; **always required** |
| **Primary CTA band** | End-of-page conversion; may be omitted **only** for the existing Hero-with-Form conversion pattern (form in hero is the sole conversion—LP) |
| **Footer** | Document chrome (prefer Reusable Block); optional only under reduced chrome |
| **SEO metadata** | Page-owned title/description (not a visual section); **always required** contract fields |

**Service / Industry detail** additionally **require** **Roles Matrix** (PR #15 §6.3; PR #16 §2.2).

**Blog / Resource detail** additionally **require** primary **Rich Content** (body from content record).

**Listing** templates require their primary **Cards / collection grid** section.

### 2.2 Optional sections

Enabled/disabled per page without forking the template:

- Summary / intro / SEO prose
- Statistics / counters
- Feature / service / industry / resource cards
- Logo cloud
- Testimonials
- FAQ
- Related links (services / industries)
- Case-study teaser
- Timeline / Team / Gallery
- Pricing
- Contact / Forms
- Roles Matrix (required on Service/Industry; optional elsewhere)

Empty optional sections are **hidden**, not shown as lorem (PR #15).

### 2.3 Repeatable sections

Two meanings—keep them distinct:

| Kind | Meaning | Examples |
|------|---------|----------|
| **Repeatable items inside a section** | List of cards/Q&As/roles inside one band | FAQ items, testimonial cards, roles rows |
| **Repeatable section instances** | Same family used more than once on a page when the template allows | Two CTA bands; regional Team grids on About |

Templates declare whether a family may appear **once** or **many**. Default for most marketing bands: **at most one** primary instance, unless the catalog says otherwise (e.g. multiple Team regions).

### 2.4 Nested sections

**Wave 1 (this architecture):** sections are **flat peers** in page order. Nesting is limited to:

- Layout wrappers inside a section (Row / Column / Container) — **not** nested section families
- Items inside a section (cards, FAQ rows) — **not** child “Hero” sections

**Not supported in wave 1:** Section-inside-Section as a first-class composition (e.g. FAQ nested under Testimonials as its own section identity). Compose visually with blocks if needed; do not invent nested section IDs yet.

### 2.5 Ordering

- Template defines **default order**.
- **Page owns** final order after creation (PR #16 §2.5).
- **Pinning rules:**
  - Navigation / Topbar → top
  - Footer → bottom
  - Primary Hero → first content section after chrome
  - Primary CTA → near end, before footer (unless LP form-in-hero exception)
- Required sections cannot be removed; optional sections may be disabled or reordered within allowed ranges.

### 2.6 Visibility

| Control | Expectation |
|---------|-------------|
| **Section on/off** | Page may disable **optional** sections |
| **Empty hide (optional only)** | Optional sections may be **hidden** only when their applicable content source is empty—for example, no items, no Reusable Block reference for block-backed sections, or empty relationships (PR #15) |
| **Empty required sections** | Required sections must **not** be silently hidden when empty. Keep them visible and/or **block publish with validation** so editors know required content is missing |
| **Device visibility** | Existing responsive style model (desktop/tablet/mobile) |
| **Editor** | Toggle optional sections without deleting structure when possible |

### 2.7 Variants

Section variants select the **component family variant** (and sometimes preset composition):

```text
Section: Hero
  variant: homepage | service | industry | career | landing
    ↓
Component family: Hero (PR #17)
  same config fields; different layout emphasis
```

Do **not** create `ServiceHeroSection` as a separate section family. Prefer `Hero` + `variant="service"`.

---

## 3. Section families

Each family: **purpose**, **allowed components**, **variants**, **repeatability**, **configuration**, **reuse**.

Component family IDs align with PR #17 / `@ob-cms/block-schema` `component-families` where they exist. Gaps (Roles Matrix, Related Links) remain documented until a composition/preset implementation PR.

### 3.1 Hero

| Field | Detail |
|-------|--------|
| **Purpose** | Above-the-fold value prop and primary action |
| **Allowed components** | Hero family; optional Form (landing); Button; Image/media primitives |
| **Variants** | `homepage`, `service`, `industry`, `career`, `landing` |
| **Repeatability** | One primary hero per page |
| **Configuration** | title, subtitle, media, background, CTAs, alignment, visibility, variant |
| **Reuse** | All marketing templates; never page-named forks |

### 3.2 CTA

| Field | Detail |
|-------|--------|
| **Purpose** | Conversion band (mid or end of page) |
| **Allowed components** | CTA compositions (text + buttons); Floating CTA where appropriate |
| **Variants** | `primary`, `banner`, `inline` |
| **Repeatability** | Usually one primary; optional secondary mid-page |
| **Configuration** | title, description, buttons, style variant, visibility, spacing/background |
| **Reuse** | Homepage, Service, Industry, LP, Careers, Contact |

### 3.3 FAQ

| Field | Detail |
|-------|--------|
| **Purpose** | Objections and common questions |
| **Allowed components** | FAQ family → Accordion registry block |
| **Variants** | `stacked`, `grouped` |
| **Repeatability** | Items repeat inside section; one FAQ section typical |
| **Configuration** | items or Reusable Block ref; ordering; visibility |
| **Reuse** | Prefer **Reusable Block** when shared across service/industry pages |

### 3.4 Testimonials

| Field | Detail |
|-------|--------|
| **Purpose** | Social proof |
| **Allowed components** | Testimonials family (video carousel / quote grid) |
| **Variants** | `quote-carousel`, `video-carousel`, `quotes-grid` |
| **Repeatability** | Items inside section |
| **Configuration** | quote, author, role, company, image; or Reusable Block ref |
| **Reuse** | Prefer **Reusable Block** for site-wide proof |

### 3.5 Timeline

| Field | Detail |
|-------|--------|
| **Purpose** | Process steps or history |
| **Allowed components** | Timeline / Event Timeline / Step Cards (consolidate via variants over time) |
| **Variants** | `process`, `history`, `steps` |
| **Repeatability** | Milestone items |
| **Configuration** | date, title, description; visibility |
| **Reuse** | How It Works, About history, Careers journey |

### 3.6 Team

| Field | Detail |
|-------|--------|
| **Purpose** | People / leadership / regional teams |
| **Allowed components** | Team Grid |
| **Variants** | `grid` (+ region grouping via content) |
| **Repeatability** | Multiple instances allowed for regional sections (About) |
| **Configuration** | member name, role, image, description |
| **Reuse** | About, Careers |

### 3.7 Cards

| Field | Detail |
|-------|--------|
| **Purpose** | Feature / service / industry / resource grids |
| **Allowed components** | Cards family; Feature List; Article Card Grid; card presets |
| **Variants** | `feature`, `service`, `industry`, `resource` |
| **Repeatability** | Card items; one grid per concern typical |
| **Configuration** | title, description, image, link, metadata; columns |
| **Reuse** | Hubs, homepage “What We Do”, listings, related teasers |

### 3.8 Pricing

| Field | Detail |
|-------|--------|
| **Purpose** | Plan comparison (rare on OB Live today) |
| **Allowed components** | Pricing presets / card plans |
| **Variants** | `table`, `cards` |
| **Repeatability** | Plan items |
| **Configuration** | plans, toggle, CTAs, visibility |
| **Reuse** | Future LP / product pages |

### 3.9 Features

| Field | Detail |
|-------|--------|
| **Purpose** | Benefit / capability narrative bands (icon lists, alternating features) |
| **Allowed components** | Cards (`feature`) or Feature List; may alias Cards feature variant |
| **Variants** | `grid`, `alternating`, `icon-list` |
| **Repeatability** | Feature items |
| **Configuration** | title, blurb, icon/image, link |
| **Reuse** | Homepage, solutions, service benefits |

> **Note:** Features and Cards overlap. Prefer **Cards** family with `feature` variant for new work; **Features** remains a section-family alias for existing presets (`features-grid`, etc.) so templates stay readable.

### 3.10 Contact / Forms

| Field | Detail |
|-------|--------|
| **Purpose** | Lead capture and contact |
| **Allowed components** | Forms family (`Form`, `Stepper Form`, `Newsletter`) |
| **Variants** | `standard`, `stepper`, `newsletter`, `hero-adjacent` (LP) |
| **Repeatability** | One primary form section typical |
| **Configuration** | fields reference, CTA, success state, visibility |
| **Reuse** | Contact, LP, gated Resource Detail |

### 3.11 Gallery

| Field | Detail |
|-------|--------|
| **Purpose** | Image / media grids |
| **Allowed components** | Gallery / image grid presets |
| **Variants** | `grid`, `masonry` (future) |
| **Repeatability** | Media items |
| **Configuration** | images, captions, visibility |
| **Reuse** | About, Careers culture, case studies |

### 3.12 Rich Content

| Field | Detail |
|-------|--------|
| **Purpose** | Long-form body / SEO prose |
| **Allowed components** | Rich content family; content + image presets |
| **Variants** | `article`, `seo-prose`, `resource` |
| **Repeatability** | Usually one primary body |
| **Configuration** | body, embeds; ownership per PR #16 §1.2.1 |
| **Reuse** | Blog Detail, Resource Detail, optional SEO bands |

### 3.13 Logo Cloud

| Field | Detail |
|-------|--------|
| **Purpose** | Trust / partners / systems strip |
| **Allowed components** | Logo Carousel |
| **Variants** | `partners`, `systems` |
| **Repeatability** | Logo items |
| **Configuration** | logos, marquee, visibility; often Reusable Block |
| **Reuse** | Homepage, Industry (systems), trust bands |

### 3.14 Statistics

| Field | Detail |
|-------|--------|
| **Purpose** | Counters / proof metrics |
| **Allowed components** | Counter Section / stats presets |
| **Variants** | `counters` |
| **Repeatability** | Stat items |
| **Configuration** | value, label, visibility |
| **Reuse** | Homepage, Industry, How It Works |

### 3.15 Roles Matrix

| Field | Detail |
|-------|--------|
| **Purpose** | Role titles + nested capability bullets (Service / Industry) |
| **Allowed components** | **Gap** — composition/preset TBD (PR #15 High); not a page-named component |
| **Variants** | `two-column`, `accordion` |
| **Repeatability** | Role rows + nested bullets |
| **Configuration** | roles, capabilities; page-local initially |
| **Reuse** | Required on Service Detail & Industry Detail |

### 3.16 Related Links

| Field | Detail |
|-------|--------|
| **Purpose** | Cross-sell sibling services / industries |
| **Allowed components** | **Gap** — Cards resolved from relationship IDs (PR #15 §6.3) |
| **Variants** | `service-cards`, `industry-cards` |
| **Repeatability** | Link/card items from ID lists |
| **Configuration** | `relatedServices` / `relatedIndustries` refs; hide when empty |
| **Reuse** | Service & Industry detail |

### 3.17 Navigation & Footer (chrome)

| Field | Detail |
|-------|--------|
| **Purpose** | Site chrome |
| **Allowed components** | Nav / Footer presets; prefer Reusable Blocks |
| **Variants** | `full-mega`, `simplified-lp` (nav); `standard` (footer) |
| **Repeatability** | One each, pinned |
| **Configuration** | structure, columns, social; shared via Reusable Block |
| **Reuse** | All full-chrome templates |

---

## 4. Composition rules

### 4.1 Valid patterns (canonical)

**Marketing detail (Service / Industry)**

```text
Nav / Topbar
  → Hero (service|industry)
  → Roles Matrix          (required)
  → Features / Cards      (optional)
  → Testimonials          (optional; prefer Reusable Block)
  → Related Links         (optional; hide if empty)
  → CTA
  → FAQ                   (optional; prefer Reusable Block)
  → Footer
```

**Homepage / narrative marketing**

```text
Nav
  → Hero (homepage)
  → Features / Cards / Stats / Logo Cloud (as narrative requires)
  → Testimonials
  → CTA
  → FAQ (optional)
  → Footer
```

**Landing Page (conversion-first)**

```text
Nav (simplified) or reduced chrome
  → Hero (landing, often form-forward)
  → Features / Social proof (optional, short)
  → CTA or inline form success path
  → Footer (optional / minimal)
```

**Blog / Resource Detail**

```text
Nav
  → Hero or article header
  → Rich Content          (content record owns body)
  → Related Cards         (optional)
  → CTA / Form gate       (resource optional)
  → Footer
```

**Careers / Contact**

```text
Nav
  → Hero (career | standard)
  → Team / Timeline / Forms / Cards as needed
  → CTA
  → Footer
```

### 4.2 Soft rules (preferred, not hard errors)

1. **One primary Hero** — do not stack two heroes.
2. **Proof before final CTA** — Testimonials / Stats / Logo Cloud before end CTA when present.
3. **FAQ near end** — after proof and related links; before footer.
4. **Related Links after proof** — not above the fold.
5. **Roles Matrix early** — after Hero / summary on Service & Industry.
6. **Hide empty optional sections** — never publish visible placeholder lorem; optional empties may hide. Required empties must stay visible and/or fail validation (§2.6).

### 4.3 Invalid / discouraged combinations

| Combination | Why |
|-------------|-----|
| Two primary Heroes | Dilutes above-the-fold; use variant or Cards instead |
| FAQ as first content section | Breaks narrative; put after value prop |
| Roles Matrix on Blog Detail | Wrong family; use Rich Content |
| Page-local duplicate of site-wide FAQ **and** a Reusable Block FAQ with same content | Conflicting sources of truth |
| `HomepageHero` / `ServiceHero` section types | Violates PR #17; use Hero + variant |
| Nesting section families (wave 1) | Not supported; keep flat order |
| Related Links with hardcoded sibling cards long-term | Prefer relationship IDs (PR #15 §6.3) |

Templates may further restrict allowed families (e.g. Blog Detail forbids Roles Matrix).

---

## 5. Section configuration contract

Every section instance may expose shared **presentation** knobs plus family-specific **content** knobs.

### 5.1 Shared presentation properties

| Property | Purpose |
|----------|---------|
| **visibility** | Section on/off; device visibility |
| **spacing** | Padding / margin / gap defaults |
| **background** | Color, image, gradient |
| **alignment** | Content alignment within the band |
| **theme** | Token set / contrast (future theme layer; structure stays stable) |
| **animation** | Optional entrance / interaction presets (existing style model) |
| **responsive behavior** | Breakpoint overrides; stack vs row |
| **container width** | Full-bleed vs contained |
| **component variant** | Family variant id (`homepage`, `banner`, …) |

### 5.2 Family-specific content properties

See §3 and PR #17 §3 / PR #16 §4. Examples:

- Hero: title, subtitle, media, CTAs  
- FAQ / Testimonials: items **or** Reusable Block ref  
- Related Links: relationship ID lists  
- Rich Content: body (page vs content record ownership)  
- Forms: fields reference, success state  

### 5.3 Configuration ownership

| Layer | Configures |
|-------|------------|
| **Section family catalog** | Allowed properties and variants |
| **Template** | Defaults for those properties |
| **Page** | Overrides, content values, visibility, order |
| **Reusable Block** | Shared fragment body when referenced |

Do not store the same content field on both page and content record (PR #16 §1.2.1).

---

## 6. Page composition examples

Assemblies use **section families** only—no page-named components. Homepage exists today as a full-layout preset; documented for parity, not reimplementation.

### 6.1 Homepage

```text
Nav / Topbar
Hero (homepage)
Features / Cards (audiences, services)
Logo Cloud / Stats (as live requires)
Testimonials (Reusable Block preferred)
Service Cards
CTA
Timeline / Security steps (optional)
FAQ / Articles (optional)
Footer
```

### 6.2 Service Detail

```text
Nav
Hero (service)
Roles Matrix          ← required
Features / benefit Cards
Testimonials          ← Reusable Block preferred
Related Links (services)
CTA
FAQ                   ← Reusable Block preferred
Footer
```

Matches PR #15 §6.3 shared contract.

### 6.3 Industry Detail

```text
Nav
Hero (industry)
Roles Matrix          ← required
Logo Cloud (systems) / Stats (optional)
Features / Cards
Testimonials
Related Links (industries)
CTA
FAQ
Footer
```

Same section skeleton as Service; content and emphasis differ.

### 6.4 Landing Page

```text
Nav (simplified) [optional reduced chrome]
Hero (landing) ± Form
Features / Cards (short)
Testimonials or Logo Cloud (optional)
CTA / Form confirmation path
Footer [optional]
```

### 6.5 Blog Detail

```text
Nav
Article header / Hero (compact)
Rich Content              ← content record owns body
Related article Cards
CTA
Footer
```

### 6.6 Resource Detail

```text
Nav
Hero
Rich Content and/or download CTA  ← content record owns asset/copy
Related resource Cards
Form gate (optional)
Footer
```

### 6.7 Careers

```text
Nav
Hero (career)
Features / culture Cards
Team / Timeline (optional)
Forms or external jobs CTA
CTA
Footer
```

### 6.8 Contact

```text
Nav
Hero
Forms (Contact)
CTA (optional)
Footer
```

---

## 7. Future extensibility

New section families are **catalog entries**, not system redesigns.

### 7.1 How to add a family

1. Define purpose, allowed components, variants, repeatability, config contract.  
2. Map to existing component families / registry blocks when possible (PR #17).  
3. Add section presets only when editor surface is intentionally expanded.  
4. Allow templates to opt in; do not mutate existing page instances (PR #16 §1.6).  
5. Prefer Reusable Blocks for shared content; relationship IDs for catalogs.

### 7.2 Example future families

| Family | Notes |
|--------|-------|
| **Comparison Table** | How It Works “traditional vs OB”; two-column feature preset first |
| **Calculator** | Interactive LP tool; bind Form / custom block later |
| **Pricing Builder** | Extends Pricing family |
| **Product Showcase** | Media + Cards hybrid |
| **Video Gallery** | Extends Gallery / Video blocks |
| **Case-study teaser** | Medium gap (PR #15); Card + Video + CTA composition |
| **Location cards** | About / Careers; Card ± Map |

Adding these must **not** require changing Hero, FAQ, or unrelated templates.

---

## 8. Relationship to prior PRs

| PR | Role | This document |
|----|------|----------------|
| **#15** | Live-site inventory, gaps, Service/Industry contract | §3.15–3.16, §6.2–6.3, hide-empty rules |
| **#16** | Template / page / ownership / starter catalog | §1–2 deepen Section layer; templates remain insert/copy |
| **#17** | Component families + variants catalog | §3 binds sections → families; no `ServiceHero` forks |

```text
PR #16 Templates
    ↓ use
PR #18 Sections (this doc)
    ↓ bind to
PR #17 Components
```

---

## 9. How PR #19 (Starter Page Templates) builds on this

**PR #19 deliverable:** [Starter Page Templates](./starter-page-templates.md).

PR #19:

1. Emits **starter templates** as ordered lists of **section families** + default variants from §6. **Done** (catalog).
2. Wires Service/Industry starters to **Roles Matrix** + **Related Links** slots (§3.15–3.16). **Documented** in starter catalog; shipping presets deferred.
3. Points Testimonials/FAQ slots at **Reusable Block** refs by default where shared. **Documented** as default reusable blocks per template.
4. Stays insert/copy (PR #15–#16); does not silently rewrite existing pages. **Respected.**
5. Does **not** invent page-named components; reuses PR #17 families. **Respected.**
6. Leaves page-creation UX polish and full editor drag/drop to later PRs—compatible with §2 ordering/visibility rules. **Respected.**

---

## 10. Non-goals (this PR)

This PR **does not** implement:

- Runtime rendering or production application code  
- Builder / editor UI (including drag & drop)  
- APIs or database schemas  
- New page templates as shipping presets  
- Business logic or publish validation enforcement  
- Homepage behavior changes  
- Package / dependency / lockfile changes  

It **only** defines the section composition contract for later template and preset work.

---

## 11. Traceability checklist

| Requirement | Location |
|-------------|----------|
| Section definition & ownership | §1 |
| Hierarchy, required/optional/repeatable/nested/order/visibility/variants | §2 |
| Section families | §3 |
| Composition rules (valid / invalid) | §4 |
| Configuration contract | §5 |
| Page composition examples | §6 |
| Extensibility | §7 |
| Non-goals | §10 |
| Bridge to PR #19 | §9 |
