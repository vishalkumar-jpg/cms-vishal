# CMS Template Architecture

**PR 2 — architecture / documentation only.**  
**Source of truth for requirements:** [OB Live Website Audit & CMS Gap Analysis](../ob-live/website-audit-and-cms-gap-analysis.md) (merged PR #15).  
**Downstream:** [Shared Component Strategy](./shared-component-strategy.md) (PR #17); [Section Composition System](./section-composition.md) (PR #18); [Starter Page Templates](./starter-page-templates.md) (PR #19); [Platform operations & roadmap](./cms-operations.md) (final docs).  
**Doc map:** [CMS docs README](./README.md).  
**Homepage:** already implemented; this document must not imply changing existing homepage application code.  
**Status:** architectural contract for implementation PRs **#3–#8**. Nothing here is claimed as shipping product behavior until those PRs land.

---

## 0. Intent

Evolve authoring from:

```text
Create Page → Manually build sections every time → Repeat layouts
```

Into:

```text
Create Website → Choose Template → Generate Page Structure → Edit Content → Publish
```

Templates must stay **insert/copy starters** in the first wave (aligned with PR #15 §6): not route-bound page types. Routes remain ordinary CMS pages. Shared synchronized fragments continue to use **Reusable Blocks**.

---

## 1. Template architecture

### 1.1 What is a Template?

| Aspect | Definition |
|--------|------------|
| **Purpose** | A reusable **starter layout definition** that encodes a page-type skeleton (sections, default component configuration, placeholders, and allowed slots). |
| **Responsibility** | Describe *structure and defaults*—not live site content for a specific URL. |
| **Why templates exist** | So operators create many similar pages (services, industries, LPs, etc.) without rebuilding layouts; so engineering adds templates without redesigning the system. |
| **How templates differ from pages** | A template is a **definition** (catalog entry). A page is a **published (or draft) instance** with its own content and layout copy. Templates are not bound to routes; pages own slugs/URLs. |

Templates generalize today’s builder **layout presets** (see `sectionPresets` / OB full-layout JSON): same conceptual class—clone onto a canvas—elevated into a named catalog with contracts, slots, and lifecycle.

### 1.2 What is a Page?

| Aspect | Definition |
|--------|------------|
| **Definition** | A **page instance** created from a template (or authored from scratch). |
| **Content ownership** | For **ordinary (non-collection) pages**, page-specific copy, media, enabled optional sections, ordering, and SEO live on the page. For **collection-backed** pages, see §1.2.1. |
| **Relationship to templates** | At creation, structure is **copied** from the template. After creation, the page is **independent** unless it explicitly references shared Reusable Blocks or relationship IDs. |

#### 1.2.1 Collection-backed templates (page vs content record)

Applies to **Blog Listing**, **Blog Detail**, **Resource Listing**, **Resource Detail**, and future collection-driven templates.

| Owner | Owns |
|-------|------|
| **Content record** | Body / content fields; assets / media fields; collection-specific data (e.g. author, categories, download asset metadata) |
| **Page** | Layout structure; slug; SEO metadata; section configuration (enablement, order, visibility, variants); relationship references |

**Precedence rule:** When content comes from a collection-backed record, the **content record is the source of truth for content fields**. The **page remains the source of truth for presentation and layout configuration**. Do not store competing copies of the same content field on both page and record.

**Rich content:** On collection-backed detail templates (Blog Detail, Resource Detail), rich/body content belongs to the **content record**, not the page. On ordinary (non-collection) pages, rich content belongs to the **page**. Listing templates do not own article/resource body fields; they bind to collection queries via section configuration.

### 1.3 Template → Page relationship

```text
Template
    ↓
Creates (copy)
    ↓
Page Instance
```

| Category | What happens |
|----------|----------------|
| **Copied at creation** | Section structure; default component configuration; initial content placeholders; default section order; default visibility flags |
| **Shared (not copied as frozen content)** | Component/block **definitions** in the registry; design-system tokens/rules; **Reusable Blocks** referenced by slots; global chrome when modeled as Reusable Blocks |
| **Independent after creation** | Page content edits; enabling/disabling optional sections; reordering; page-local overrides of placeholders |

**Example**

- **Copied:** Hero slot with empty title; Roles Matrix empty list; CTA band defaults; FAQ slot pointing at a shared Reusable Block ref (or empty for page-local).
- **Shared:** `Hero` / `Accordion` / `Video Testimonial Carousel` block implementations; theme tokens; “Global Testimonials” Reusable Block body.
- **Independent:** Editing the hero headline on `/services/virtual-assistant/` does not change `/services/call-center/`.

### 1.4 Ownership

| Asset | Owner | Notes |
|-------|--------|------|
| **Templates** | Platform / site admins (catalog) | Versioned definitions; not live URLs |
| **Pages** | Site editors | Own content + layout instance |
| **Sections (slots)** | Template defines allowed/default set; **page** owns enablement, order, and filled content | |
| **Components / blocks** | Engineering (`@ob-cms/blocks` registry) | Rendering + configuration contract |
| **Content** | Page (ordinary) or content record / Reusable Block (shared) | Collection-backed: content record is SoT for body/media (§1.2.1) |

### 1.5 Lifecycle

```text
Draft Template
    ↓
Published Template (available in “Choose Template”)
    ↓
Used By Pages (each gets an independent layout copy)
    ↓
Template Evolution (new version / updated defaults)
```

- **Draft template:** editable definition; not offered for new pages (or marked experimental).
- **Published template:** selectable in page creation.
- **Used by pages:** creation copies structure; pages do not stay live-linked for content overwrite.
- **Evolution:** publishing a new template version affects **new** pages by default; existing pages keep their copies (see versioning).

### 1.6 Versioning expectations

| Concern | Expectation |
|---------|-------------|
| **Template versions** | Templates carry an opaque version (or revision id) for catalog/history. |
| **Existing pages after updates** | **Do not** silently rewrite page layouts or page-owned content when a template changes. |
| **Shared updates** | Changes to **Reusable Blocks** (nav, shared testimonials/FAQs) **do** propagate to pages that reference them. |
| **Avoiding breakage** | Opt-in “re-apply template skeleton” (future tooling) only; never unexpected overwrite of custom page content. |
| **Breaking component contracts** | Handled in component/registry PRs with migration notes—not by mutating historical page JSON silently. |

### 1.7 Template independence

- Each template is a self-contained catalog entry (id, label, page-type tag, section list, contracts).
- Adding **Careers** or **Resource Detail** must not require changing **Service Detail**.
- Templates share **section families** and **components**, not each other’s page instances.
- No homepage-specific hard wiring inside other templates; Homepage remains its own template entry (already implemented as a full-layout preset).

---

## 2. Template composition model

> **Deep dive:** reusable section families, composition rules, configuration contracts, and page assemblies are specified in [Section Composition System](./section-composition.md) (PR #18). This section remains the template-level summary.

### 2.1 Hierarchy

```text
Template
  ↓
Sections (slots)
  ↓
Components (registered block families)
  ↓
Blocks (concrete block nodes in the layout tree)
  ↓
Editable Content (props, rich text, media, refs)
```

| Layer | Role |
|-------|------|
| **Template** | Named starter: which sections exist, defaults, required vs optional |
| **Section** | Logical band (Hero, FAQ, CTA, …) mapped to one or more block subtrees |
| **Component** | Reusable block **family** (e.g. Hero) with variants—not page-named forks |
| **Block** | Instance node in the serialized layout |
| **Editable content** | Field values, media, relationship IDs, Reusable Block refs |

### 2.2 Required sections

Every marketing page template includes (unless an LP explicitly opts into reduced chrome):

| Section | Purpose |
|---------|---------|
| **Document chrome** | Site header/footer via shared Reusable Blocks or standard nav/footer sections |
| **Primary hero** | Above-the-fold value prop + primary CTA |
| **Primary CTA band** | End-of-page conversion |
| **SEO metadata** | Page-owned title/description (not a visual section, but required contract fields) |

Detail templates (**Service**, **Industry**) additionally require **Roles Matrix** per PR #15 §6.3.

Listing/detail content templates require their primary list or article body as required (see catalog).

### 2.3 Optional sections

Enabled/disabled per page without forking the template:

- Summary / intro
- Stats / counters
- Feature or audience cards
- Logo cloud
- Testimonials
- FAQ
- Related services / industries
- Case-study teaser
- Article grid
- Forms
- Team / timeline / location grids (About/Careers)
- SEO prose band

Empty optional sections are **hidden**, not shown as lorem (PR #15).

### 2.4 Repeatable sections

Repeatable item lists inside a section (not duplicate entire page templates):

| Section family | Repeatable units |
|----------------|------------------|
| Testimonials | Quote / video cards |
| FAQs | Q&A pairs |
| Feature / service / industry cards | Card items |
| Logo cloud | Logo items |
| Roles matrix | Role + capability bullets |
| Team | Person cards |
| Timeline | Milestone items |

### 2.5 Ordering

- Template defines **default order**.
- **Page owns** final order after creation.
- Future editor: drag/drop reorder of optional/enabled sections within template-allowed rules.
- **Priority rules:** required sections cannot be removed; chrome typically pinned top/bottom; hero remains first content section.

### 2.6 Visibility

| Control | Expectation |
|---------|-------------|
| **Section on/off** | Page can disable optional sections |
| **Device visibility** | Follow existing responsive style model (desktop/tablet/mobile); templates may set defaults |
| **Editor control** | Editors toggle visibility without deleting structure when possible |

### 2.7 Variants

Prefer **one component family + variants** over duplicated components:

```text
Hero (family)
  ├─ Variant: Homepage
  ├─ Variant: Service / Industry
  ├─ Variant: Career
  └─ Variant: Landing (compact / form-forward)
```

Variants share configuration contract fields; differ in layout emphasis (split vs centered, form beside hero, etc.). Same pattern for CTA, Feature Cards, etc.

---

## 3. Starter template catalog

> **Full catalog:** purposes, section orders, kits, metadata, and lifecycle for all starters are specified in [Starter Page Templates](./starter-page-templates.md) (PR #19). This section remains the original outline.

Initial library. Each entry is a **catalog template** (future insert/copy starter). Homepage already exists as an implemented full-layout preset—documented here for completeness, **not** to reopen homepage implementation.

### 3.1 Homepage Template

| Field | Detail |
|-------|--------|
| **Purpose** | Primary marketing home; brand + conversion narrative |
| **Supported page type** | `homepage` |
| **Default sections** | Topbar/Nav, Hero, value/audience bands, press/partnerships, testimonials, service grid, CTA, stats, security/steps, articles/FAQ as live requires, Footer |
| **Optional sections** | Demo video, LinkedIn strip, extra CTAs |
| **Editor experience** | Full-layout starter; heavy visual editing; shared chrome via Reusable Blocks where applicable |
| **Reuse** | Section families feed Service/Solution/About; **do not modify existing homepage app code in this PR** |

### 3.2 About Template

| Field | Detail |
|-------|--------|
| **Purpose** | Trust / differentiation (Why OB, Team, Security, Locations as variants or sibling starters) |
| **Supported page type** | `about` (variant: why / team / security / locations) |
| **Default sections** | Chrome, Hero, narrative or team/timeline/location grids, CTA, Footer |
| **Optional sections** | Logo trust, testimonials, industry cross-links, download CTA, history timeline |
| **Editor experience** | Pick About variant; fill page-owned content; Team uses repeatable person cards |
| **Reuse** | Hero, Feature Cards, Team, Timeline, CTA |

### 3.3 Service Detail Template

| Field | Detail |
|-------|--------|
| **Purpose** | Sell one service line |
| **Supported page type** | `service-detail` |
| **Default sections** | Chrome, Hero, Roles Matrix, benefit cards, Testimonials (Reusable Block slot), Related Services, CTA, FAQ (Reusable Block slot), Footer |
| **Optional sections** | Case-study teaser, article grid, SEO prose, summary |
| **Editor experience** | Create page → Service Detail → fill PR #15 §6.3 fields; related IDs optional |
| **Reuse** | Same contract as Industry Detail; emphasize `relatedServices` |

### 3.4 Industry Detail Template

| Field | Detail |
|-------|--------|
| **Purpose** | Vertical-specific staffing page |
| **Supported page type** | `industry-detail` |
| **Default sections** | Same skeleton as Service Detail; optional stats/trust dual lists |
| **Optional sections** | Systems logo cloud, volume counters, case study, articles, SEO prose |
| **Editor experience** | Identical contract to Service Detail; emphasize `relatedIndustries` |
| **Reuse** | **Same page-data contract** as Service Detail (PR #15 §6.3) |

### 3.5 Landing Page Template

| Field | Detail |
|-------|--------|
| **Purpose** | Campaign / lead-gen conversion |
| **Supported page type** | `landing` |
| **Default sections** | Reduced or full chrome (configurable), Hero (landing variant), value props, Form, Testimonials, CTA |
| **Optional sections** | FAQ, logo cloud; **Experiment** wrapper for A/B (capability already exists—template wiring only) |
| **Editor experience** | Optional hide mega-nav; form + HubSpot/embed conventions |
| **Reuse** | Hero, Forms, Testimonials, Experiment |

### 3.6 Careers Template

| Field | Detail |
|-------|--------|
| **Purpose** | Employer brand + path to open roles |
| **Supported page type** | `careers` |
| **Default sections** | Chrome, Hero, culture/benefits cards, regional panels, CTA to ATS/open roles, Footer |
| **Optional sections** | Press/articles; job embed only if product later requires (prefer external link per audit) |
| **Editor experience** | Avoid empty placeholder bands; link out for live jobs |
| **Reuse** | Hero, Feature Cards, Location cards, CTA |

### 3.7 Contact Template

| Field | Detail |
|-------|--------|
| **Purpose** | Contact / inquiry |
| **Supported page type** | `contact` |
| **Default sections** | Chrome, Hero or page title, Form (or Stepped Form), optional Map/locations, Footer |
| **Optional sections** | FAQ, office cards |
| **Editor experience** | Form-centric; validation via existing forms pipeline |
| **Reuse** | Forms, Map, CTA |

### 3.8 Blog Listing Template

| Field | Detail |
|-------|--------|
| **Purpose** | Index of articles |
| **Supported page type** | `blog-listing` |
| **Default sections** | Chrome, Hero/header, Article Card Grid (collection-bound), Pagination/filters (conceptual), Footer |
| **Optional sections** | Featured post, categories |
| **Editor experience** | Prefer **content module / collection**, not Craft-cloned article HTML |
| **Reuse** | Article Card Grid, collection relationships |

### 3.9 Blog Detail Template

| Field | Detail |
|-------|--------|
| **Purpose** | Single article |
| **Supported page type** | `blog-detail` |
| **Default sections** | Chrome, Article header, Rich Content body, related articles, CTA, Footer |
| **Optional sections** | Author, TOC, share |
| **Editor experience** | Body from content record; template supplies chrome + related |
| **Reuse** | Rich Content, Article cards, CTA |

### 3.10 Resource Listing Template

| Field | Detail |
|-------|--------|
| **Purpose** | Index of resources (guides, PDFs, case studies library) |
| **Supported page type** | `resource-listing` |
| **Default sections** | Chrome, Hero, resource card grid (collection), Footer |
| **Optional sections** | Filters, featured resource, CTA |
| **Editor experience** | Collection-driven cards |
| **Reuse** | Same listing patterns as blog listing with different card schema |

### 3.11 Resource Detail Template

| Field | Detail |
|-------|--------|
| **Purpose** | Single resource / downloadable / long-form asset page |
| **Supported page type** | `resource-detail` |
| **Default sections** | Chrome, Hero, Rich Content and/or download CTA, related resources, Footer |
| **Optional sections** | Form gate, testimonials |
| **Editor experience** | Asset + copy owned by content record; template supplies structure |
| **Reuse** | Download/CTA conventions, related cards |

**Adding a future template:** register a new catalog entry with page-type id, required/optional sections, and contracts—no change to existing template definitions.

---

## 4. Section configuration contract

Shared **section families** used across templates. Configuration is conceptual (props/slots), not an API schema.

For each family: **required** vs **optional** config; **variant**; **content ownership** (page vs Reusable Block vs relationship).

### 4.1 Hero

| | |
|--|--|
| **Required** | Title (headline); primary CTA label + URL |
| **Optional** | Subtitle; image/media; background; secondary CTA; alignment; device visibility |
| **Variant** | Homepage / Service-Industry / Career / Landing |
| **Ownership** | Page |

### 4.2 CTA band

| | |
|--|--|
| **Required** | Primary CTA label + URL |
| **Optional** | Supporting copy; secondary CTA; background; visibility |
| **Variant** | Full-bleed / compact / with media |
| **Ownership** | Page |

### 4.3 Feature cards

| | |
|--|--|
| **Required** | ≥1 card with title |
| **Optional** | Icon/image; blurb; link; columns |
| **Variant** | 3-up audience / service grid / benefit trio |
| **Ownership** | Page (items); optional collection later |

### 4.4 Testimonials

| | |
|--|--|
| **Required** | None to publish page (section hideable) |
| **Optional** | Items or **Reusable Block ref**; video modal |
| **Variant** | Quote carousel / video carousel |
| **Ownership** | Prefer Reusable Block when shared; else page |

### 4.5 FAQ

| | |
|--|--|
| **Required** | None (optional section) |
| **Optional** | Q&A items or **Reusable Block ref** |
| **Variant** | Single / grouped accordion |
| **Ownership** | Prefer Reusable Block when shared; else page |

### 4.6 Pricing

| | |
|--|--|
| **Required** | Plan/items if section enabled |
| **Optional** | Toggle annual/monthly; CTA per plan |
| **Variant** | Table / cards / calculator bind |
| **Ownership** | Page (rare on OB Live today) |

### 4.7 Timeline

| | |
|--|--|
| **Required** | ≥1 milestone if enabled |
| **Optional** | Dates/labels; media |
| **Variant** | Process steps / history / 30-day HIW |
| **Ownership** | Page |

### 4.8 Team

| | |
|--|--|
| **Required** | ≥1 person if enabled |
| **Optional** | Photo; role; region grouping |
| **Variant** | Grid by region |
| **Ownership** | Page |

### 4.9 Logo cloud

| | |
|--|--|
| **Required** | None if section off |
| **Optional** | Logos; marquee vs static |
| **Variant** | Partners / systems strip |
| **Ownership** | Page or Reusable Block |

### 4.10 Rich content

| | |
|--|--|
| **Required** | Body if section enabled (blog/resource detail) |
| **Optional** | Embeds; pull quotes |
| **Variant** | Article / SEO prose / resource body |
| **Ownership** | **Content record** on collection-backed detail templates (Blog/Resource Detail); **page** on ordinary (non-collection) pages. Never both for the same body field. |

### 4.11 Forms

| | |
|--|--|
| **Required** | Form id / fields if section enabled |
| **Optional** | Success message; HubSpot/embed conventions |
| **Variant** | Standard / stepper / LP beside-hero |
| **Ownership** | Page binds to existing forms system |

### 4.12 Navigation sections

| | |
|--|--|
| **Required** | Nav structure for full-chrome templates |
| **Optional** | Topbar; reduced chrome for LP |
| **Variant** | Full mega / simplified LP |
| **Ownership** | Prefer **Reusable Block** / shared nav data for sync |

### 4.13 Footer

| | |
|--|--|
| **Required** | Footer for full-chrome templates |
| **Optional** | Columns; social; copyright |
| **Variant** | Standard marketing footer |
| **Ownership** | Prefer **Reusable Block** |

### 4.14 Roles matrix (Service / Industry)

| | |
|--|--|
| **Required** | ≥1 role (detail templates) |
| **Optional** | Nested capability bullets |
| **Variant** | Two-column list / accordion |
| **Ownership** | Page-local initially; optional catalog later (PR #15) |

### 4.15 Related links grid

| | |
|--|--|
| **Required** | None |
| **Optional** | `relatedServices` / `relatedIndustries` ID lists |
| **Variant** | Service cards / industry cards |
| **Ownership** | **Relationships** (IDs); cards resolved for display |

---

## 5. Shared component strategy

```text
Existing registry components (@ob-cms/blocks)
    ↓
Reusable section compositions (slots / presets)
    ↓
Template section lists
    ↓
Pages (instances)
```

### Avoid

```text
HomepageHero · ServiceHero · CareerHero · LandingHero
```

### Prefer

```text
Hero component
  + variant: homepage | service-industry | career | landing
```

| Topic | Rule |
|-------|------|
| **Shared components** | One family per concern (Hero, CTA, Feature Cards, Testimonials, FAQ, …) |
| **Ownership** | Engineering owns rendering + prop contracts; templates only select variants and defaults |
| **Avoiding duplication** | New marketing needs → new **variant** or section composition, not a renamed fork |
| **Maintenance** | Fidelity and a11y fixes land once in the family; all templates benefit |
| **PR #3 alignment** | Shared Components PR implements/extends families and presets **against this contract**—not one-off page components |

Synchronized multi-page **content** still uses **Reusable Blocks**, not duplicate component types.

---

## 6. Page creation flow

> **Full platform flow** (Create Website → Kit → Template → Copy → Edit → Preview → Publish), registry, and versioning detail: [cms-operations.md](./cms-operations.md) §1–§4.

### 6.1 Primary journey

```text
Create Page
    ↓
Choose Template
    ↓
Generate Default Sections (layout copy + placeholders + default refs)
    ↓
Customize Content (page-owned fields; optional section toggles)
    ↓
Preview
    ↓
Publish
```

Website-level journey (optional kit) is specified in [cms-operations.md §4.1](./cms-operations.md). Aligned with PR #15: independent layout copy after creation; Reusable Block slots remain shared.

### 6.2 Lifecycle actions

| Action | Behavior |
|--------|----------|
| **Draft** | Page exists unpublished; incomplete required fields block publish (per contracts) |
| **Publish** | Page becomes available on its slug; validation per template contract |
| **Duplicate** | Copy an **existing page** (layout + content) to a new draft page—still independent |
| **Clone from template** | Same as create-from-template (fresh placeholders), not a live link to the template |
| **Future template updates** | Do **not** unexpectedly overwrite custom page content; shared Reusable Blocks update in place; optional explicit re-apply skeleton later |

### 6.3 Website-level framing

“Create Website” (product framing) = configure site + theme + chrome Reusable Blocks, then create pages from the template catalog. This architecture doc does not define multi-tenant provisioning APIs.

---

## 7. Data ownership model

Conceptual only—**no database schema, no APIs**.

### 7.1 Template owns

- Structure (section list)
- Default sections and order
- Allowed components / variants per slot
- Initial configuration and placeholders
- Required vs optional rules
- Template version metadata

### 7.2 Page owns

- Content (copy, media) on **ordinary** pages; on **collection-backed** pages, content fields defer to the content record (§1.2.1)
- Enabled optional sections
- Section ordering
- Page-specific customization and overrides
- Slug / SEO
- Relationship references (IDs), not the related bodies themselves
- Page-local roles matrix (until catalog exists)
- Publish state

### 7.2.1 Content record owns (collection-backed only)

- Body / rich content fields
- Assets / media fields
- Collection-specific data

### 7.3 Components own

- Rendering rules
- Configuration contract (props)
- Variants
- Responsive/default style behavior

### 7.4 Relationships own

- Connected content references (service/industry IDs, collection entries)
- Resolution of related cards / article grids
- Broken-ref behavior: warn; omit cards; do not dead-link

### 7.5 Reusable Blocks own

- Synchronized fragment content (shared testimonials, FAQs, chrome)

---

## 8. Future extensibility

| Need | How this architecture supports it |
|------|-----------------------------------|
| **New industries** | New pages from **Industry Detail** template + content; same structure |
| **New services** | New pages from **Service Detail** template |
| **New campaign LPs** | **Landing Page** template + optional Experiment |
| **Themes** | Design tokens / theme layer skin components; templates stay structure-only |
| **Localization** | Page (or content-record) locale variants; shared structure; Reusable Blocks per locale or keyed fields—decide in later PRs |
| **Collections** | Blog/Resource listing & detail templates bind grids/bodies to collections without new page structures per item |

Standardized section families + insert/copy templates + relationship refs mean scale is **content growth**, not **layout redesign**.

---

## 9. Non-goals (this PR)

This PR **does not** implement:

- Runtime or production application code
- Builder/editor UI changes
- New components or rendering changes
- Database schemas or migrations
- API / backend changes
- CMS product functionality beyond documentation
- Homepage behavior changes

It **only** defines the architectural contract for PR #3 (Shared Components) through later template implementation PRs.

---

## 10. Traceability to PR #15

| PR #15 topic | This architecture |
|--------------|-------------------|
| Insert/copy presets; no route-bound types (wave 1) | §1 Template/Page relationship |
| Reusable Blocks for shared testimonials/FAQs | §4 Testimonials/FAQ; §7 ownership |
| Service/Industry identical data contract | §3.3–3.4; §4 Roles/Related; catalog |
| Hide empty optional sections | §2 Optional; creation flow |
| No silent template overwrite | §1.6 Versioning; §6 Future updates |
| Homepage already done | §3.1; non-goals |

---

## 11. Shared components & section composition (PR #3 / #17 / #18)

### Completed deliverables

**PR #3 / #17 — Shared Component Strategy:** [shared-component-strategy.md](./shared-component-strategy.md) (+ typed family catalog in `@ob-cms/block-schema`).

**PR #18 — Section Composition System:** [section-composition.md](./section-composition.md) — how templates assemble **sections** from those component families.

### Remaining PR #3 checklist items

PR #3 originally called for:

1. Inventory existing registry components against §4–§5 families. **Done** (see shared-component-strategy §1).
2. Add **variants** and section presets—not `ServiceHero`-style forks. **Variants catalogued** in PR #17; section composition rules in PR #18; new Section Library presets deferred until an implementation PR (avoid editor surface churn).
3. Provide compositions for Roles Matrix and Related Links slots used by Service/Industry templates. **Documented** in section-composition §3.15–3.16; shipping presets deferred.
4. Wire starter templates to Reusable Block slots for shared testimonials/FAQs. **Documented defaults** in [starter-page-templates.md](./starter-page-templates.md) (PR #19); registry/create-page wiring in [cms-operations.md](./cms-operations.md) runtime Phase 1–3.
5. Leave page creation UX and full template catalog implementation to subsequent PRs, but stay compatible with §6 flow and §7 ownership. **Respected.**
