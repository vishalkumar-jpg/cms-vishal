# OB Live Website Audit & CMS Gap Analysis

**PR 1 — documentation only.**  
**Reference site:** [https://www.officebeacon.com/](https://www.officebeacon.com/)  
**CMS context:** OB-CMS dynamic page builder with reusable blocks (`packages/blocks`, `packages/block-schema`).  
**Out of scope for this PR:** UI implementation, runtime code, dependency changes, visual pixel diffs.  
**Follow-on architecture:** [CMS Template Architecture](../cms/template-architecture.md) (PR 2) turns this audit into the reusable template contract.

## 1. Purpose and method

This audit reviews **remaining** Office Beacon (OB) Live marketing pages after the homepage (and the How It Works layout seed) are already represented in the CMS builder. Goals:

1. Document page purpose, layout structure, reusable sections, CMS reuse, gaps, responsive behavior, and interactions.
2. Build a cross-page **component inventory** of repeated patterns.
3. Recommend **CMS templates** and prioritize missing capabilities (High / Medium / Low).

**Sources used**

- Live pages fetched from `www.officebeacon.com` (primary IA from site nav in `packages/blocks/src/ob-nav-data.ts`).
- Existing CMS block registry (`packages/block-schema/src/block-props.ts` — ~72 block types).
- Existing OB builder seeds: homepage (`scripts/build-ob-homepage.mjs`, `obHomepage.json`) and How It Works (`scripts/build-ob-how-it-works.mjs`, `obHowItWorks.json`).
- Render fidelity notes in `packages/blocks/FIDELITY.md` (homepage-oriented; not a site-wide content audit).

**Excluded from deep review (external or secondary surfaces)**

- `https://events.officebeacon.com/` (separate subdomain / product surface).
- `https://app.officebeacon.com/` (product app, not marketing CMS).
- Individual blog article bodies (treated as a **content type** / listing pattern, not one-off page builds).
- Press-release article bodies under `/press-release/` (same listing/article pattern as blog).

**Homepage status (already implemented — baseline only)**

Homepage is implemented as an editable builder layout (Topbar, Navbar, Hero, audience cards, press, partnerships/logo strip, testimonials, service cards, CTA banners, counters, security cards, process steps, LinkedIn/articles, FAQ, Footer). This audit does **not** re-implement it; patterns below reuse what homepage already proved.

---

## 2. Reviewed pages (by template family)

Pages below are grouped by **shared layout family**, not listed as one-off implementations. Representative live URLs were reviewed for each family; sibling URLs in the same family share the same structure with different copy, imagery, and card content.

### 2.1 Global chrome (all marketing pages)

| Aspect | Observation |
|--------|-------------|
| **Purpose** | Persistent brand chrome and conversion entry points |
| **Structure** | Top utility / mega-nav (desktop) + mobile accordion lists; dark footer with columns + social + copyright |
| **Reusable sections** | Topbar, Navbar (dropdown + mega), Footer |
| **CMS reuse** | `Topbar`, `Navbar` / `NavMenu` / `Nav Dropdown` / `Nav Mega`, `Footer`, `Footer Columns`, `Footer Links`, `Social Icons`, `Copyright Block`; shared data in `ob-nav-data.ts` |
| **Gaps** | Mobile slide-in drawer fidelity (see `FIDELITY.md`); sticky CTA / chat widgets if present on live |
| **Responsive** | Desktop mega/dropdown; &lt;1024/&lt;768 collapse to mobile lists |
| **Interactions** | Hover/focus-within mega panels; mobile expand/collapse |

---

### 2.2 Hub index pages

#### Services hub — `/services/`

| Field | Detail |
|-------|--------|
| **Purpose** | Catalog all service lines; drive to service detail or “Build Your Remote Team” |
| **Layout** | Hero → intro/value copy → security callout + **stats row** → **service card grid** → **testimonial carousel** → bottom CTA |
| **Reusable sections** | Hero split/centered, stats counters, icon/image service cards, testimonials, CTA band |
| **CMS reuse** | `Hero Section`, `Counter Section`, `Feature List` / `Card`+`Grid`, `Video Testimonial Carousel`, `Button`, layout primitives |
| **Gaps** | Hub-specific “category filter” not required if cards are static; optional **related services** carousel component |
| **Responsive** | Multi-column card grids → 1–2 columns on tablet/mobile |
| **Interactions** | Testimonial modal/expand (“Read More”, video × overlay) |

#### Industries hub — `/industries/`

| Field | Detail |
|-------|--------|
| **Purpose** | Industry directory + trust stats + path to industry detail |
| **Layout** | Hero → positioning copy → **stats** → **industry card grid** → “don’t see your industry” contact CTA → testimonials → trial CTA → FAQ → article grid → SEO prose |
| **Reusable sections** | Same as services hub + FAQ accordion + article cards + long SEO text block |
| **CMS reuse** | Above + `Accordion`, `Article Card Grid`, `Rich Text` / `Paragraph` |
| **Gaps** | **Industry card** preset (icon + title + short blurb + link); “unlisted industry” contact strip |
| **Responsive** | Card grid collapse; FAQ full-width |
| **Interactions** | FAQ expand; testimonial carousel |

**Sibling hubs (same family):** solutions are outbound from nav but each solution is a **solution detail** page (below), not a separate hub with unique chrome.

---

### 2.3 Service detail pages

**Representative:** `/services/virtual-assistant/`  
**Family members (nav):** all Staffing Services mega links (e.g. logistics, call center, data entry, AI workflows, project management, finance/accounting VA, legal VA, HR, interpretation, webstore, sales/lead-gen, marketing, creative, software, IT, cybersecurity, plus category parents under `/services/...-virtual-assistant/`).

| Field | Detail |
|-------|--------|
| **Purpose** | Sell a specific service line with roles, benefits, social proof, related services, FAQ, content |
| **Layout** | Hero + primary CTA → **roles / capabilities list** (often two-column: role titles + bullet detail) → **benefit cards** (3-up) → testimonials → **case-study / video CTA** → **related services** cards → lead CTA (“Build Your … Team”) → FAQ → article grid → long SEO footer prose |
| **Reusable sections** | Hero, capability matrix/list, benefit cards, testimonials, case-study teaser, related-links grid, lead CTA, FAQ, articles, SEO prose |
| **CMS reuse** | `Hero Section`, `Feature List`, `Step Cards` / `Card`+`Grid`, `Video Testimonial Carousel`, `Video`+`Modal`, `Article Card Grid`, `Accordion`, `Button`, `Rich Text` |
| **Gaps** | **Related services carousel/grid** (content-driven sibling links); **capability / roles matrix** (title + nested bullets) as a first-class block or strong `Feature List` preset; **case-study teaser** (poster + “View Case Study”) |
| **Responsive** | Roles list stacks; 3-up benefits → 1 column; related cards swipe or stack |
| **Interactions** | Testimonial media modal; FAQ accordion |

---

### 2.4 Industry detail pages

**Representative:** `/industries/insurance-remote-staffing/`  
**Family members:** promotional products, finance & accounting, healthcare, legal, property management, construction (+ any additional industry URLs linked from hub).

| Field | Detail |
|-------|--------|
| **Purpose** | Vertical-specific staffing value prop, roles, trust, volume stats, pain points |
| **Layout** | Hero → logo/systems trust strip → **roles fulfilled** (capability matrix) → **who we support / why trust us** (two lists) → **volume counters** (quotes, COIs, renewals, …) → pain/value cards → testimonials → case study → lead form/CTA → FAQ → articles → SEO prose |
| **Reusable sections** | Heavily overlaps **service detail**; adds systems logo strip, dual trust lists, high-volume counters |
| **CMS reuse** | Same as service detail + `Logo Carousel` (systems), `Counter Section`, `Feature List` |
| **Gaps** | Same matrix / related / case-study gaps; optional **dual-list trust panel** (“Who we support” \| “Why they trust us”) |
| **Responsive** | Counter grids wrap; dual lists stack |
| **Interactions** | Same as service detail |

**Template recommendation (future):** One **Industry Detail** starter template (insert/copy layout; see §6) filled per industry; do not fork per industry in code.

---

### 2.5 Solution / outcome pages

**Representative:** `/solutions/reduce-cost-overhead`  
**Family members:** boost-sales-and-reach, save-time-increase-efficiency, security-compliance, member-partnerships.

| Field | Detail |
|-------|--------|
| **Purpose** | Outcome-led messaging (cost, sales, efficiency, security, partnerships) |
| **Layout** | Hero → problem/value narrative → **service-line card grid** → **why choose** benefit trio → stats → audience cards (startup / ops / enterprise) → FAQ → bottom CTA → articles → SEO prose |
| **Reusable sections** | Hero, narrative, service cards, benefit trio, counters, audience cards, FAQ, CTA, articles |
| **CMS reuse** | Homepage-proven patterns: `Hero Section`, `Feature List`, `Counter Section`, `Card` grids, `Accordion`, `Article Card Grid` |
| **Gaps** | Low — largely assemblable from existing blocks; need **content presets**, not new primitives |
| **Responsive** | Standard card/stat collapse |
| **Interactions** | FAQ; optional logo marquee |

---

### 2.6 How It Works — `/how-it-works`

| Field | Detail |
|-------|--------|
| **Purpose** | Explain managed delivery model and 30-day onboarding timeline |
| **Layout** | Hero → “how we build” feature bullets → “everything you need” feature set → testimonials → **timeline (Day 1–30)** → stats → comparison narrative → bottom CTA |
| **Reusable sections** | Hero, feature lists, testimonials, **process timeline**, counters, CTA |
| **CMS reuse** | Seed already exists (`obHowItWorks.json`); `Step Cards`, `Timeline` / `Event Timeline`, `Counter Section`, `Feature List` |
| **Gaps** | Align live timeline visual with `Timeline` vs composed `Step Cards`; ensure comparison “traditional vs OB” section has a clear `Comparison Table` or two-column feature preset |
| **Responsive** | Timeline becomes vertical stack on mobile |
| **Interactions** | Testimonial carousel |

**Status:** Layout seed present; treat as **template to publish/polish**, not greenfield.

---

### 2.7 About cluster

#### Why Office Beacon — `/why-office-beacon/`

| Field | Detail |
|-------|--------|
| **Purpose** | Differentiation / trust narrative |
| **Layout** | Hero → difference narrative → audience cards → logo trust → testimonials → **industry cross-links** → getting-started steps → CTA |
| **CMS reuse** | Homepage + solution patterns; `Step Cards` for “First we / Then you / Launch” |
| **Gaps** | Low for structure; industry cross-link grid = same as industries hub cards |

#### Team — `/team`

| Field | Detail |
|-------|--------|
| **Purpose** | Leadership directory by region |
| **Layout** | Hero → **regional team grids** (US, India, Philippines, South Africa, Mexico) → **history timeline** → CTA |
| **CMS reuse** | `Team Grid`, `Timeline`, `Heading`/`Paragraph`, `Button` |
| **Gaps** | **Regional team sections** as repeating `Team Grid` instances (content); ensure headshot + title + role fields match live; history timeline content binding |
| **Responsive** | Grids → fewer columns |
| **Interactions** | Minimal (static portraits) |

#### Certifications / data protection — `/certification-data-protection`

| Field | Detail |
|-------|--------|
| **Purpose** | Security & compliance proof |
| **Layout** | Hero → trust narrative → security feature cards → **PDF download CTA** → industry compliance cards → bottom CTA |
| **CMS reuse** | `Feature List`, `Card` grid, `Button`/`Link` for PDF, industry cards |
| **Gaps** | **File download / asset CTA** block (or Media + Button convention documented); badge/logo strip for cert marks |
| **Responsive** | Standard |

#### Delivery centers / office locations — `/delivery-centers`

| Field | Detail |
|-------|--------|
| **Purpose** | Global footprint storytelling |
| **Layout** | Hero → why global locations → **location cards** (India, Mexico, South Africa, Philippines) → facilities narrative → CTA |
| **CMS reuse** | `Card`+`Grid`, `Map` (optional), `Feature List`, `Hero Section` |
| **Gaps** | **Location card** preset (flag/image + title + blurb); optional map pins via `Map` |
| **Responsive** | Location grid stacks |

---

### 2.8 Careers — `/careers`

| Field | Detail |
|-------|--------|
| **Purpose** | Employer brand + drive to ATS / open roles |
| **Layout** | Hero → culture narrative → benefits cards → **regional culture panels** → career narrative → location stories → CTA to open positions → press/articles |
| **CMS reuse** | `Hero Section`, `Feature List`, `Card` grids, `Article Card Grid`, `Button` |
| **Gaps** | **Job listing embed / ATS feed** (High if careers must stay current without manual edits); external “View Open Positions” link is acceptable Medium workaround; live page currently shows placeholder “Heading 1 / Lorem ipsum” region — CMS should avoid shipping empty placeholder sections |
| **Responsive** | Benefit/location cards stack |
| **Interactions** | External link to roles; no in-page job board observed in fetch |

---

### 2.9 Lead-generation landing page — `/lp/build-your-remote-team`

| Field | Detail |
|-------|--------|
| **Purpose** | Conversion-focused LP (often paired with form / paid traffic) |
| **Layout** | Simplified chrome or hero-forward → value props → testimonials (form may sit beside/below hero on live; marketing fetch shows content + social proof) |
| **CMS reuse** | `Hero Section`, `Feature List`, `Video Testimonial Carousel`, `Form` / `Stepper Form`, optional reduced Navbar; `Experiment` already available for A/B |
| **Gaps** | **LP starter template** with optional chrome hiding; **HubSpot/embedded form** wiring conventions for the LP skeleton. (`Experiment` / A/B is already a CMS capability—not a gap.) |
| **Responsive** | Form stacks under hero on mobile |
| **Interactions** | Form validation; testimonial media |

---

### 2.10 Content listing surfaces (pattern only)

| Surface | Pattern | CMS approach |
|---------|---------|----------------|
| Blog / industry articles grids (embedded on many pages) | Card grid + “View More” | `Article Card Grid` + Collection/blog module already in platform |
| Press (`/press-release/`) | Listing + article | Same content-type pattern |
| LinkedIn “Latest” (homepage) | Social/embed strip | `Social Feed` / `Embed` / curated `Article Card Grid` |

Individual article HTML is **not** recommended as Craft page clones; use the CMS blog/content pipeline.

---

## 3. Reusable component inventory

Cross-page patterns → preferred CMS representation. Prefer **one shared component** over page-specific forks.

| Pattern ID | Section pattern | Appears on | Prefer CMS building block | Notes |
|------------|-----------------|------------|---------------------------|-------|
| **G-NAV** | Topbar + Navbar mega/dropdown | All marketing | `Topbar`, `Navbar` family + `ob-nav-data` | Shared reusable header |
| **G-FOOT** | Multi-column dark footer | All marketing | `Footer` family | Shared reusable footer |
| **S-HERO** | H1 + subcopy + primary CTA (± image) | Almost all | `Hero Section` or composed Section/Row | Homepage already composed; promote presets |
| **S-STATS** | 3–6 metric counters | Hubs, solutions, HIW, industry | `Counter Section` | Volume metrics on industry pages |
| **S-CARDS-3** | 3-up benefit / audience cards | Homepage, solutions, why OB, service detail | `Feature List` / `Card`+`Grid` | Startup / Ops / Enterprise trio repeats often |
| **S-SERVICE-GRID** | Icon + title + blurb service cards | Homepage, services hub, solutions | `Feature List` or card grid preset | Same visual language as “What We Do” |
| **S-INDUSTRY-GRID** | Industry tiles with deep links | Industries hub, why OB, certs | Card grid preset | Parameterized links |
| **S-TESTIMONIAL** | Quote carousel ± video modal | Nearly all | `Video Testimonial Carousel` (+ **Reusable Block** when shared) | Sync already exists via Reusable Blocks; gap is population + template slot wiring |
| **S-LOGOS** | Partner / systems marquee | Homepage, solutions, industry | `Logo Carousel` (`marquee`) | Systems strip on industry |
| **S-STEPS** | Numbered process (5 steps / 30-day) | Homepage, HIW | `Step Cards` / `Timeline` | Keep one timeline vocabulary |
| **S-FAQ** | Accordion Q&A | Hubs, details, solutions | `Accordion` (+ **Reusable Block** when shared) | Page-local when unique; Reusable Block when identical across pages |
| **S-ARTICLES** | Blog card grid | Many | `Article Card Grid` | Bind to CMS content |
| **S-CTA-BAND** | Full-width CTA + button | End of most pages | Section + `Button` / `Floating CTA` | SoFi-style / “Ready to scale” |
| **S-ROLES-MATRIX** | Role titles + nested capability bullets | Service & industry detail | **Gap** → new preset or enhanced Feature List | Highest duplication after chrome |
| **S-RELATED** | Sibling service/industry cards | Service detail | **Gap** → related-links grid | Content relations |
| **S-CASE** | Case study / video teaser | Service & industry detail | Video + Card + Button | Optional dedicated teaser |
| **S-TRUST-DUAL** | Two side-by-side bullet lists | Industry detail | Row of two `Feature List`s | Preset helpful |
| **S-TEAM** | Portrait grids by region | Team | `Team Grid` | Repeat per region |
| **S-HISTORY** | Year + milestone timeline | Team | `Timeline` / `Event Timeline` | |
| **S-LOCATION** | Geo cards | Delivery centers, careers | Card grid / `Map` | |
| **S-DOWNLOAD** | PDF / asset CTA | Certifications | Button + media asset | Document convention |
| **S-SEO-PROSE** | Long closing SEO copy | Detail & hub pages | `Rich Text` / Paragraphs | Often below fold |
| **S-FORM-LP** | Lead form | LP + CTAs | `Form` / `Stepper Form` | Integrates with existing forms |

---

## 4. Template opportunities

Recommended **future CMS page starter templates** (reusable starting layouts + slot content), not one-off pages. These are **proposed** artifacts in the same general class as today’s insert/copy presets unless PR 2 decides otherwise—see §6.

| Priority | Template | Covers | Rationale |
|----------|----------|--------|-----------|
| **P0** | **Marketing Chrome** (header/footer partials) | All | Already partially shared; formalize as reusable blocks |
| **P0** | **Service Detail** | ~15+ service URLs | Highest page count; shared skeleton |
| **P0** | **Industry Detail** | ~7+ industry URLs | Same skeleton as service + stats/trust |
| **P1** | **Hub Index** (Services / Industries) | 2 hubs | Card directory + stats + testimonials |
| **P1** | **Solution / Outcome** | 5 solutions | Outcome messaging; mostly existing blocks |
| **P1** | **How It Works** | 1 | Seed exists — publish as template |
| **P2** | **About — Why OB** | 1 | Thin variant of solution/homepage |
| **P2** | **About — Team** | 1 | Team Grid + Timeline |
| **P2** | **About — Security / Locations** | 2 | Feature + location card patterns |
| **P2** | **Careers** | 1 | Employer brand; ATS integration decision |
| **P2** | **Lead Gen LP** | `/lp/*` | Reduced chrome + form |
| **P3** | **Article / Press listing** | Blog & press | Use content module, not Craft clones |

**Do not** create separate templates per service or industry slug; use one template + content entries.

---

## 5. CMS gap analysis (prioritized)

### High

| Gap | Why it matters | Suggested direction |
|-----|----------------|---------------------|
| **Service / Industry Detail templates** | Dozens of live URLs share one layout | Ship templates + content model before one-off builds |
| **Roles / capabilities matrix section** | Repeats on every service & industry page | Composite block or strong preset (title list + nested bullets + optional tab/accordion) |
| **Shared testimonial + FAQ reuse (conventions)** | Same carousel/FAQ appears on many pages | **Not a missing sync primitive** — use existing **Reusable Blocks**. Remaining work: populate shared content, agree starter-template **slots**, wire those slots to Reusable Blocks, optionally later resolve from collections |
| **Related services / industries module** | Cross-sell on detail pages | Content-relationship field → card grid |
| **Mobile nav drawer parity** | Documented in `FIDELITY.md`; affects all pages | Client drawer matching live IA |

### Medium

| Gap | Why it matters | Suggested direction |
|-----|----------------|---------------------|
| **Case-study teaser section** | Common mid-page conversion beat | Card + Video + CTA preset |
| **Dual trust lists panel** | Industry pages | Two-column Feature List preset |
| **Location / delivery-center cards** | Locations + careers | Card preset ± Map |
| **Certification / download CTA** | Security page | Document Media + Button; optional Download block |
| **LP template (optional chrome)** | Paid/lead flows | Template flag to hide full mega-nav |
| **Timeline visual polish for HIW** | Match Day 1–30 live design | Configure `Timeline` / `Step Cards` presets |
| **Careers ATS embed or live jobs link policy** | Keep roles current | Prefer external ATS link unless product requires embed |

### Low

| Gap | Why it matters | Suggested direction |
|-----|----------------|---------------------|
| **Social icon SVG fidelity** | `FIDELITY.md` | Inline SVGs when brand QA requires |
| **Press / LinkedIn curated strips** | Homepage + careers | `Social Feed` / Embed / editorial cards |
| **Map pins on delivery centers** | Nice-to-have | Existing `Map` block |
| **Comparison table (traditional vs OB)** | HIW narrative | Existing `Comparison Table` |
| **Per-page SEO prose conventions** | Many pages | Editorial guidelines + `Rich Text` |

**Already sufficient (assemble, don’t invent):** Hero, counters, feature/service cards, logo marquee, article grids, accordion FAQ, forms, team grid, basic timeline, footer/nav primitives, experiment/A/B.

---

## 6. Current CMS capability vs proposed template architecture

This section **separates what OB-CMS supports today** from **what this audit recommends deciding and designing later** (PR 2 — Template Architecture and subsequent implementation PRs). Nothing in the “proposed” subsections is claimed as shipping behavior.

### 6.1 What the CMS supports today

| Capability | Current behavior |
|------------|------------------|
| **“Templates” / presets** | Insert/copy **layout presets** in the builder (e.g. `sectionPresets.ts`, OB homepage / How It Works full-layout JSON). Dropping a preset clones a `SerializedLayout` onto the canvas. |
| **Route / page-type binding** | **Not supported.** Presets are not bound to URL routes or typed page kinds. A page’s route/slug is independent site/page metadata. |
| **After creation** | The page layout is an **independent copy**. Editing one page does not update other pages that were started from the same preset. |
| **Synchronized shared content** | **Reusable Blocks** are the existing mechanism for shared, synchronized fragments. Other shared marketing content (e.g. repeated testimonials) is either duplicated in-page or manually kept in sync unless wrapped in a Reusable Block. |
| **Structured catalogs** | Service/industry “parameterized” pages as first-class CMS entities with resolved related links do **not** exist yet; operators assemble pages from blocks/presets. |

Today’s OB homepage and How It Works work fit this model: authored (or generated) layouts inserted as builder content, not route-bound page types.

### 6.2 What this audit proposes for future implementation

These are **architectural recommendations for future design/implementation**. They must be decided in PR 2 and built later; they are **not** present capabilities. The detailed contract lives in [CMS Template Architecture](../cms/template-architecture.md).

| Topic | Proposed direction (to decide in PR 2+) |
|-------|----------------------------------------|
| **Service Detail / Industry Detail** | Prefer **insert-only starter templates** (same class of artifact as today’s presets) that encode the shared section skeleton, **not** new route-bound page types in the first migration wave. Routes remain ordinary CMS pages (`/services/…`, `/industries/…`). Revisit typed/route-bound page kinds only if product later needs schema-enforced URLs or auto-listing. |
| **Ownership / source of truth** | **Page layout + page-specific copy** live on the page document after creation. **Cross-page shared fragments** (global chrome, shared testimonial set, shared FAQ set when identical) should use **Reusable Blocks** (or a later collection) as source of truth. **Catalog facts** that power cards/related links (service ↔ service, industry ↔ industry) should eventually live in structured content records—not only hard-coded layout JSON—once a content model exists. |
| **Roles matrix** | Model as either (a) page-local structured section props on a dedicated/enhanced block, or (b) structured fields on a Service/Industry content record that a section block resolves. Prefer (b) when many pages share the same role taxonomy; until then, page-local props are acceptable. |
| **Related services / industries** | Resolve from **relationship fields** on structured records (or explicit ID lists) into a card grid section—not by duplicating sibling cards by hand on every page long-term. |
| **Testimonials / FAQs** | **Reusable Blocks already synchronize** shared sets. Future work is slot conventions in starter templates, content population, optional collection-backed resolution, and page-local overrides when a detail page needs unique Q&A or quotes—not a new sync feature. |
| **Reusable vs page-specific** | **Reusable/synchronized:** marketing chrome (nav/footer), shared social-proof carousel, shared global FAQ, shared partnership logo strip. **Page-specific/editable:** hero copy, roles matrix instance, related-links selection, case-study teaser, SEO prose, page CTAs. |
| **Page creation flow (proposed)** | Operator chooses a starter template (Service Detail, Industry Detail, …) → CMS creates a **new page** with an **independent layout copy** and empty/placeholder slots → operator fills page-specific content and optionally binds Reusable Blocks for shared slots → publish. No implication that the page remains linked to the template definition unless a later sync feature is explicitly designed. |
| **Migration / override when templates evolve** | Evolving a starter template **does not automatically rewrite** existing pages (consistent with today’s preset copy semantics). Updates to shared chrome/testimonials/FAQs propagate only through **Reusable Block** (or future collection) edits. Optional later tooling may offer “re-apply template skeleton” as an explicit, opt-in migration—not silent mutation. |

**Explicit non-goals of this audit section:** it does not specify APIs, database schemas, builder UI, or runtime resolution code. Those belong in PR 2+ after these ownership and binding choices are agreed.

### 6.3 Shared Service / Industry page-data contract (proposed)

**Architectural recommendation only** — identical contract for **Service Detail** and **Industry Detail** starter templates. It does not describe shipping APIs or runtime code. “Owner” names the intended source of truth after PR 2+ decisions; relationship fields are **IDs/refs**, not duplicated card trees.

| Field | Required | Owner / Source of Truth | Representation | Missing-data behavior |
|-------|----------|-------------------------|----------------|------------------------|
| **title** | Yes | Page | Page title string | Block publish if empty |
| **slug** | Yes | Page (route metadata) | URL slug string | Block publish if empty or conflicting |
| **hero** | Yes | Page | Hero section props (headline, subcopy, media, primary CTA) | Block publish if headline empty; allow media optional with placeholder |
| **summary** | No | Page | Short supporting blurb | Omit section or hide empty slot |
| **body / content** | No | Page | Rich text / composed sections (benefits, narrative, SEO prose) | Omit empty sections; do not render placeholder lorem |
| **rolesMatrix** | Yes (detail templates) | Page-local props initially; optionally later a Service/Industry catalog record | Structured list: role title + nested capability bullets | Block publish if zero roles; warn in builder |
| **relatedServices** | No | Relationship refs (service page/record IDs) | ID list → related card grid | Hide related-services section when list empty |
| **relatedIndustries** | No | Relationship refs (industry page/record IDs) | ID list → related card grid | Hide related-industries section when list empty |
| **testimonials** | No | **Reusable Block** when shared; else page-local carousel content | Reusable Block ref **or** inline testimonial items | Prefer shared Reusable Block; if neither ref nor items, hide section |
| **faqs** | No | **Reusable Block** when shared; else page-local accordion items | Reusable Block ref **or** inline Q&A items | Prefer shared Reusable Block; if neither ref nor items, hide section |
| **cta** | Yes | Page | CTA band label + URL (± secondary) | Block publish if primary CTA missing |
| **seo** | Yes | Page | Title, description, optional OG fields | Block publish if SEO title/description empty; fall back only if product already defines global defaults |

**Publish-time validation (proposed expectations):** require `title`, `slug`, `hero` (headline), `rolesMatrix` (≥1 role), `cta`, and `seo` title/description before publish. Treat `relatedServices` / `relatedIndustries` / `testimonials` / `faqs` / `summary` / optional body sections as soft: **hide when empty**, do not fail publish. Broken relationship IDs should warn in the builder and omit those cards rather than render dead links.

**Identical for both templates:** Service Detail and Industry Detail share this field set; only default related-ref orientation and starter copy differ (services emphasize `relatedServices`; industries emphasize `relatedIndustries` and may fill volume stats via page body/counters—not extra required contract fields).

---

## 7. Recommended implementation priority (post–PR 1)

Ordered for maximum reuse and live-site coverage. **This PR does not implement these steps.** Items below remain recommendations; section 6 defines how “template” should be read relative to current CMS behavior.

1. **Formalize Marketing Chrome** reusable header/footer (nav data already centralized).
2. **Ship Service Detail + Industry Detail templates** with Roles Matrix + Related Links slots, and wire shared Testimonials/FAQ slots to existing **Reusable Blocks** (content + conventions—not a new sync primitive).
3. **Hub Index template** for `/services/` and `/industries/`.
4. **Solution template** (thin layer over existing homepage/section presets).
5. **Publish/polish How It Works** from existing seed.
6. **About cluster** (Why / Team / Security / Locations) using Team Grid, Timeline, location cards, download CTA.
7. **Careers + LP** templates after ATS/form integration decisions.
8. Fidelity follow-ups (mobile drawer, social icons) tracked with visual QA — complementary to templates.

---

## 8. Page review checklist (coverage map)

| Live area | Example URL(s) | Template family | CMS status |
|-----------|----------------|-----------------|------------|
| Homepage | `/` | Homepage (done) | Implemented |
| How It Works | `/how-it-works` | How It Works | Seed exists |
| Services hub | `/services/` | Hub Index | Gap — template |
| Service details | `/services/virtual-assistant/`, … | Service Detail | Gap — template |
| Industries hub | `/industries/` | Hub Index | Gap — template |
| Industry details | `/industries/insurance-remote-staffing/`, … | Industry Detail | Gap — template |
| Solutions | `/solutions/reduce-cost-overhead`, … | Solution | Gap — template |
| Why OB | `/why-office-beacon/` | About — Why | Gap — template |
| Team | `/team` | About — Team | Gap — template |
| Certifications | `/certification-data-protection` | About — Security | Gap — template |
| Locations | `/delivery-centers` | About — Locations | Gap — template |
| Careers | `/careers` | Careers | Gap — template |
| Lead LP | `/lp/build-your-remote-team` | Lead Gen LP | Gap — template |
| Blog/Press cards | embedded + `/blog/…`, `/press-release/` | Content module | Prefer CMS content, not Craft clones |
| Events | `events.officebeacon.com` | External | Out of scope |

---

## 9. Responsive and interaction summary

| Concern | Live behavior | CMS implication |
|---------|---------------|-----------------|
| Breakpoints | Desktop mega-nav; tablet/mobile collapse (~1024/768) | Keep container-query / OB responsive CSS path |
| Card grids | 3–4 columns → 1–2 → 1 | Grid/Feature List responsive props |
| Carousels | Touch-swipe testimonials/logos on mobile | Existing carousel touch CSS |
| FAQ | Accordion expand | `Accordion` |
| Media | Testimonial video overlays | `Modal` + `Video` |
| Forms | LP / CTA lead capture | Existing `Form` pipeline |
| Motion | Logo marquee; subtle CTA hovers | `Logo Carousel` marquee; CSS hover on buttons |

---

## 10. Summary for PR 1 reviewers

- Remaining OB Live marketing coverage is dominated by **two detail templates** (Service, Industry) plus **hub**, **solution**, **about**, **careers**, and **LP** families.
- Most visuals can be assembled from **existing** registry blocks; the real work is **templates + content models + a few high-leverage section presets** (roles matrix, related links), not dozens of new unique components.
- Homepage and How It Works seeds already validate chrome, hero, cards, counters, steps, testimonials, and footer patterns — extend those rather than inventing parallel systems.
- **Today vs later:** current CMS templates are insert/copy presets with independent pages and Reusable Blocks for sync; parameterized Service/Industry “templates” and structured relationship resolution are **proposed future architecture** (see §6), not existing product behavior.
