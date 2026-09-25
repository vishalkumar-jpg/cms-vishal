# Phase H2 — Design Application (Pre-Implementation Audit)

**Status:** Audit only — no H2 production code.  
**Branch for audit work:** `feat/hubspot-phase-h2-design-application-audit` (from `origin/develop`).  
**H1 source of truth:** `origin/feat/hubspot-phase-h1-design-tokens` (PR #118, not merged to `develop` at audit time).  
**Audit date:** 2026-09-21.

---

## 1. H1 → H2 contract summary

H2 consumes **`HubspotPageDesignContract`** from `buildHubspotPageDesignContract(upm)` (`hubspot-design-contract.ts` on H1 branch). It does **not** re-parse raw HubSpot JSON when this bundle is present.

### Inputs

| Artifact | Description |
|----------|-------------|
| `HubspotUniversalPage` | Phase C extraction output (regions → `HubspotSourceNode` tree with `sourcePath`, `id`, `payload`, provenance). |
| `HubspotPageDesignContract.version` | `"1"` (`UNIVERSAL_DESIGN_DATA_VERSION`). |
| `contract.nodes[]` | Per UPM node with design data (`HubspotNodeDesignBundle`). |
| `contract.pageDesign` | H2-facing `PageDesignContract` (same node refs + profile + diagnostics). |
| `contract.diagnostics` | Sorted `DesignExtractionDiagnostic[]` (mirrors `pageDesign.diagnostics`). |

### Per-node bundle (`HubspotNodeDesignBundle`)

- **`sourcePath`** — stable HubSpot path (matches `custom.hubspot.sourcePath` on layout nodes today).
- **`nodeId`** — UPM node id (matches layout node id when converted via `stableNodeIdFromPath` — **verify at H2 implementation**; today module leaf id is `${sourcePath}/…` suffix, not always raw UPM id).
- **`parentNodeId`** — UPM parent reference.
- **`nodeKind`** — e.g. `module`, `layout_section`, …
- **`entries[]`** — `HubspotDesignEntry`: `{ entryKey, hubspotLocator, role, data: UniversalDesignData }`.
- **`resolved[]`** — `{ entryKey, hubspotLocator, role, styleModel, unresolved[] }` from `resolveUniversalDesignToStyleModel`.
- **`losslessSlices[]`** — `{ locator, raw }` audit trail (H2 must not silently drop).

### Identity keys

- **`entryKey`** = `` `${hubspotLocator}::${role}` `` (`hubspotDesignEntryKey`).
- **`hubspotLocator`** — e.g. `payload.styles.title`, `params.style_settings.typography.heading_font`.
- **`role`** — semantic string (see §4).

### `UniversalDesignData` (per entry)

- **`version`**: `"1"`.
- **`role`**: semantic role (not HubSpot field path).
- **`desktop`**: `UniversalDesignLayer` (default/desktop design).
- **`responsive`**: optional record keyed by **`tablet` | `mobile` | `largeDesktop`** only (not `desktop` / `laptop` in UDD schema).
- **`unresolved`**: optional extraction-time items (e.g. `DESIGN_UNMAPPED_FIELD`).

### `UniversalDesignLayer` (normalized, not raw HS)

Sections: `typography`, `colors` (text/background/border), `spacing`, `sizing`, `borders`, `shadows`, `layout`, `visibility`, `effects` (opacity, **inert** `rawCss`), `extensions` (themeClassNames, motion, appearancePreset). Passthrough allowed but resolver only maps known fields.

### H1 resolver output (`resolveUniversalDesignToStyleModel`)

- Produces **partial `StyleModel`** per entry (section-level merge).
- **`effects.rawCss`** → diagnostic only; never `StyleModel.customCss`.
- **Colors** → `safeColorForStyleModel` only (hex/rgb/rgba/CSS Color 4 space syntax); named/invalid → `DESIGN_RAW_COLOR_CSS_INERT`.
- **Theme classes / motion** → unresolved diagnostics + `SiteDesignProfile.themeClassNames`; not StyleModel.
- **Responsive UDD layers** → nested under `styleModel.responsive.<bucket>` via section merge (not full replace).
- **`mergeResolvedDesigns`** — merges multiple entries’ StyleModels (used in tests; H2 must define per-part vs module-root merge rules).

### `buildSiteDesignProfile`

Aggregates unique **literal** color strings, font families, theme class names from UDD — **no** semantic primary/secondary. Phase J may persist; H2 may use for fallbacks only, not as automatic StyleModel injection.

### What H2 receives (mechanical)

For each converted **native** layout node with matching **`sourcePath`**:

1. Lookup `contract.nodes` by `sourcePath`.
2. For each target visual part, select entries by **`role`** (and optionally `entryKey`).
3. Apply **`resolved[].styleModel`** (or merge `data` → resolve if re-run needed — prefer pre-resolved from contract for determinism).
4. Record unapplied entries / unresolved / lossless-only fields as **diagnostics** (extend layout import diagnostics or node custom metadata — TBD in implementation).
5. Do **not** apply raw `losslessSlices` to StyleModel without normalization path.

---

## 2. StyleModel capability matrix (OB)

Based on `packages/block-schema/src/styles.ts`, `responsive-breakpoint-css.ts`, `responsive-gen.ts`, `packages/blocks/src/lib.tsx` (`cssFromStyles`).

| Source design field (UDD / HS) | StyleModel target | Status |
|-------------------------------|-------------------|--------|
| typography.fontFamily | `typography.fontFamily` | **SUPPORTED** (H1 resolver maps) |
| typography.fontSize | `typography.fontSize` | **SUPPORTED** |
| typography.fontWeight / bold | `typography.fontWeight` | **SUPPORTED** |
| typography.lineHeight | `typography.lineHeight` | **SUPPORTED** |
| typography.letterSpacing | `typography.letterSpacing` | **SUPPORTED** |
| typography.textAlign / layout.textAlign | `typography.textAlign` | **SUPPORTED** |
| typography.color | `colors.textColor` | **SUPPORTED** (safe colors only) |
| colors.text/background/border | `colors.textColor` / `backgroundColor` / border via `borders.borderColor` | **SUPPORTED** |
| spacing.* / gap | `spacing.*` | **SUPPORTED** |
| sizing.* | `sizing.*` | **SUPPORTED** |
| borders.radius/width/color | `borders.borderRadius` / `borderWidth` / `borderColor` | **SUPPORTED** |
| shadows.boxShadow | `shadows.boxShadow` | **SUPPORTED** |
| effects.opacity | `effects.opacity` | **SUPPORTED** |
| visibility.hiddenTablet/Mobile | `responsive.tablet/mobile.hidden` | **SUPPORTED** (H1 resolver) |
| visibility.hiddenDesktop | — | **NOT CURRENTLY SUPPORTED** (no H1 mapping to `responsive` or `advanced.visibility`) |
| visibility.zIndex | `position.zIndex` | **SUPPORTED** |
| layout flex/grid fields | `layout.*` | **SUPPORTED** |
| effects.rawCss | — | **NOT SUPPORTED** (inert by design) |
| extensions.themeClassNames | profile + diagnostic | **NOT StyleModel** — Phase J / manual theme |
| extensions.motion | diagnostic | **NOT SUPPORTED** in StyleModel (Phase I+ / interactions) |
| settings:* hover colors | — | **NOT SUPPORTED** (`styles.states.*` exists in OB but H1 does not map HS hover fields) |
| responsive typography/spacing at tablet/mobile/largeDesktop | `styles.responsive.<bp>.*` | **SUPPORTED BUT NEEDS WIRING** (H1 produces; H2 must attach to block `props.styles`) |
| background-image overlays | `colors.backgroundImage` | **SUPPORTED** resolver path limited; **SUPPORTED BUT NEEDS WIRING** for responsive vars |
| advanced.visibility (CSS) | `advanced.visibility` | **SUPPORTED BUT NEEDS WIRING** (resolver can set; no import path yet) |
| partStyles / sub-part styles | block props | **NEEDS GENERIC OB EXTENSION** for composite blocks (Feature List, Step Cards, etc.) |

Renderer path: **`cssFromStyles`** + `blocks.css` / `blocks-responsive-overrides.css` — no HubSpot branches.

---

## 3. Native block / part styling (E / F1 / F2)

| Block | Phase | Sub-parts (visual) | Block-level `styles` today | Per-part styling | Notes |
|-------|-------|-------------------|---------------------------|------------------|-------|
| Heading | E | single heading | schema yes; import **empty** | no | HS `level` often **defers** conversion |
| Rich Text | E | HTML body | import **empty** | no | `<h2>` etc. use global `.ob-rich-text__body` CSS |
| Feature List | F | icon, title, description, card | import **empty** | no | hardcoded `.ob-feature-card*` |
| Step Cards | F1 | number, title, description, CTA | import **empty** | no | hardcoded `.ob-step-card*` |
| Tabs | F1 | tab label, panel | import **empty** | no | `resolveSurfaceStyles` on chrome only |
| Counter Section | F1 | value, label, description | import **empty** | no | inline font sizes in component |
| Image | F2 | figure, img | import **empty**; `imageStyles` schema | partial split in component | HS `styles`/`animation` → defer |
| Gallery | F2 | item, caption | import **empty** | no | `.ob-gallery__*` |
| Logo Carousel | F2 | slide, logo img | import **empty** | no | `.ob-logo-carousel__*` |
| Button / Link | — | — | **Not converted** (defer Group) | — | Phase G **UNKNOWN** in repo |
| Embed / Group fallback | D/E | wrapper | placeholder | wrapper only | deferred modules |

**No HubSpot-specific renderer hacks** exist today.

---

## 4. Module-part design matrix (corpus roles only)

Roles observed across `packages/block-schema/src/__tests__/fixtures/hubspot/*.json` (H1 branch scan):

| HubSpot role | Typical native block (if converted) | OB visual part target | StyleModel target (H1 resolved) | Existing support | H2 work class |
|--------------|-------------------------------------|------------------------|--------------------------------|------------------|---------------|
| `surface.module` | module root | block wrapper | spacing, layout, gap, module-level | root `props.styles` schema | **A** wiring |
| `surface.structural` | css/animation on payload | wrapper / structural | extensions, rawCss diagnostics | diagnostics only | **A** + fallback |
| `part:title` | Counter Section / articles* | stat label / title | typography + colors | root only | **B** partStyles or **A** if mapped to root |
| `part:number` | Counter Section | stat value | typography | **B** | |
| `part:prefix` / `part:suffix` | Counter Section | affixes | typography | **B** | |
| `part:grid` | Counter/Gallery/Logos | grid container | layout + spacing.gap | root layout | **A** + layout CSS |
| `part:alignment` | Counter Section | alignment | layout / typography.textAlign | **A** | |
| `part:visibility` | many | hide breakpoints | responsive.hidden | **A** wiring to block | |
| `part:tabs` | Tabs | tab strip | typography/layout | **B** | |
| `part:description` / `part:author` / `part:post_meta` / `part:tags` | articles* (often deferred) | card meta | typography | **UNKNOWN** block | defer diagnostics |
| `settings:typography.*` | Step Cards / Counter Section | matching text part | typography | **B** | |
| `settings:steps_card.*` | Step Cards | step number/card shell | colors, borders, sizing | **B** | |
| `settings:button*` / `settings:button_style.*` | steps/stats CTAs | button surface | colors, spacing, borders | **F** until Button block converts | |
| `settings:badge.*` | steps/stats | badge | colors, typography | **B** or **F** | |
| `settings:card.*` | stats | stat card shell | colors, borders, spacing | **B** | |
| `settings:layout.*` | steps/stats | section layout | spacing, sizing | **A** on root | |
| `settings:media.*` | stats | media column | sizing, borders | **B** / **F** if no media part | |

\*Articles module: H1 **extracts** design; native conversion status **UNKNOWN** — verify against `tryConvertComplexHubspotModule` before H2 assumes a block type.

---

## 5. Responsive mapping

### H1 representation

- HubSpot buckets mapped in extract: `default`/`desktop` → UDD **`desktop`** layer; `tablet` → **`responsive.tablet`**; `mobile` → **`responsive.mobile`**; `desktop_lg` → **`responsive.largeDesktop`**.
- **`spacing_mobile`** on typography parts → **`responsive.mobile.spacing`**.
- **`part:visibility`** → `visibility.hiddenTablet` / `hiddenMobile` (and desktop flags in UDD if present — resolver maps tablet/mobile only today).

### OB representation

- Breakpoints: `desktop`, `largeDesktop`, `laptop`, `tablet`, `mobile`.
- Publish: desktop inline + **`--ob-r-*`** CSS vars from `responsiveCssVars`.
- Merge order: tablet includes laptop layer; mobile includes laptop+tablet (`mergeStyleModelAtBreakpoint`).

### H2 merge strategy (recommended)

1. Apply **desktop** StyleModel sections to block `props.styles` base.
2. For each UDD bucket present, map **`largeDesktop` → `styles.responsive.largeDesktop`**, **`tablet` → `styles.responsive.tablet`**, **`mobile` → `styles.responsive.mobile`** using **section-level merge** (same as H1 `mergeStyleModelSections` / `mergeStyleModels`).
3. **Do not** replace entire `props.styles.responsive[bp]` objects when merging module + part entries.
4. **`laptop`**: no UDD source — do not invent; optional Phase I bridge from tablet heuristics.
5. **`hiddenDesktop`**: gap — either extend H1 resolver (pre-H2) or Phase I; document as **Phase I** if not fixed in H1.

---

## 6. Color / typography safety (post–CodeRabbit H1)

H2 must **consume** H1 outputs; **do not re-normalize** except when combining layers.

### Colors (H1 `normalize-color.ts` on PR branch)

- Hex 3/4/6/8 + HubSpot opacity → rgba.
- Comma `rgb`/`rgba` with captured alpha; malformed → undefined.
- CSS Color 4 space-separated + `/` alpha.
- Named colors / invalid → `css` on UDD only; StyleModel via `safeColorForStyleModel` only.
- HubSpot **`opacity` field** overrides embedded alpha when both present (rgb path).

### Typography (H1 `normalize-typography.ts`)

- `size_unit` preserved (px, rem, em, %, vw, vh).
- Unitless numeric/string sizes append normalized unit.

**H2 rule:** Apply resolved StyleModel color strings as-is; never spread UDD `NormalizedColor` objects into props.

---

## 7. Visual-parity gap list

| Priority | Gap |
|----------|-----|
| **P0** | Native blocks import with **empty `props.styles`** despite H1 contract |
| **P0** | **Role → part** mapping for Counter Section, Step Cards, Feature List, Tabs |
| **P0** | **`sourcePath` lookup** from layout node to design bundle |
| **P0** | **Module root** (`surface.module`) spacing/gap/layout |
| **P1** | **Responsive** tablet/mobile/largeDesktop on blocks |
| **P1** | **Visibility** (`part:visibility`) |
| **P1** | **settings:typography.*** → part typography |
| **P1** | **Composite partStyles** (generic OB) for steps/counters/features |
| **P2** | Button/badge/card settings while modules defer |
| **P2** | Theme class names → Phase J |
| **P2** | Motion / animation extensions |
| **P2** | Rich Text internal heading parity vs `Heading` block |
| **P2** | Hover state colors from HS settings |

---

## 8. Generic OB extensions (no HubSpot hacks)

| Gap | Class | Approach |
|-----|-------|----------|
| Apply StyleModel at import | **A** | H2 wiring in block-schema import path |
| Composite sub-part styling | **B** | Extend blocks with `partStyles` + `data-subpart` pattern (Hero precedent) |
| Responsive bg/border gaps | **C** | Extend `RESPONSIVE_CSS_PROPS` + regen CSS (cross-cutting) |
| Full breakpoint/laptop strategy | **D** | Phase I |
| Theme tokens / chrome | **E** | Phase J |
| Raw CSS / unmapped fields | **F** | Diagnostics + losslessSlices |
| Button/Link native convert | **G** | Phase G (UNKNOWN schedule) |

---

## 9. Proposed H2 architecture

```
UPM + buildHubspotPageDesignContract (H1, at import time)
        ↓
Map: sourcePath → HubspotNodeDesignBundle
        ↓
convertHubspotUpmToLayout (existing) + tryConvertHubspotModuleNode (existing)
        ↓
applyHubspotDesignToNativeBlock (NEW, pure)
  - inputs: block Node, bundle, role→part map for resolvedName
  - merge StyleModels: module root + parts (deterministic order by entryKey)
  - output: new props.styles (+ optional partStyles), design diagnostics
        ↓
SerializedLayout → migrate/repair → renderer (unchanged)
```

### Recommended location

| Piece | Path |
|-------|------|
| Design application | `packages/block-schema/src/hubspot-upm/apply-hubspot-design.ts` (NEW) |
| Role → part map | `packages/block-schema/src/hubspot-upm/hubspot-design-part-map.ts` (NEW) |
| Types | Reuse H1 `HubspotPageDesignContract`, `DesignExtractionDiagnostic` |
| Hook point | `convert-layout.ts` after `tryConvertHubspotModuleNode` success (single traversal) |
| Index exports | `hubspot-upm/index.ts` (apply function + types only) |

### Rules

- **Pure**, deterministic, no UPM mutation, no raw payload reads for design when contract provided.
- **Immutable** props: clone before merge; use existing `mergeStyleModels` from H1 resolver module.
- **Provenance**: extend `custom.hubspot` with `appliedDesignEntryKeys?: string[]` (proposal — confirm schema with senior review).
- **Fallback**: unresolved stays diagnostic; never silently drop lossless slices.
- **Validation**: existing `blockPropSchemas` / `styleModelSchema` on merged props.

---

## 10. Test plan (H2)

| Area | Tests |
|------|-------|
| Module-level styles | counters-native: gap, module root |
| Part-level | counters: `part:number`, `part:title` |
| Colors / rgba alpha | fixture or unit on merged `props.styles.colors` |
| Typography | steps/stats settings fonts |
| Spacing / sizing | settings:layout.* |
| Borders / shadows | steps_card / card settings |
| Visibility | part:visibility → responsive.hidden |
| Responsive | tablet/mobile typography from counters grid |
| Malformed / inert | raw CSS, named colors → diagnostics, no StyleModel pollution |
| Provenance | `custom.hubspot.appliedDesignEntryKeys` |
| Determinism | double-apply same contract |
| No UPM mutation | snapshot payload |
| Layout pipeline | migrate(), repairLayout(), blockPropSchemas |
| Regressions | Phase E, F, F1, F2, G (if present), scoped import suites |

**Fixtures:** Reuse `layout-sections-module-counters-native.json`, `steps-native`, `stats-native`, `tabs-native`, `button-f2-native` (theme class diagnostics), `layout-sections-module.json`. **New fixtures:** minimal synthetic module with single unmapped `style_settings` field only if corpus cannot assert page-level diagnostic + apply path in one test.

---

## 11. H2 scope boundary

### In H2

- Apply H1 `StyleModel` slices to **native** blocks at import/conversion.
- Module + part role mapping for **converted** blocks.
- Safe merge + diagnostics + provenance.
- Use pre-resolved contract entries.

### Not H2

- Phase I full responsive/laptop/hiddenDesktop strategy.
- Phase J theme/assets/chrome.
- Visual regression framework.
- API / Admin / Renderer / CI / DB.
- Page-specific CSS, module-id hacks, HubSpot branches in renderer.
- Re-implementing H1 extraction/normalization.

---

## 12. Estimates, blockers, confirmation

| Item | Value |
|------|--------|
| **Estimated LOC** | ~1,400–2,400 (apply + part map + tests; excludes generic block partStyles if scoped out) |
| **Blockers** | **PR #118 merge** into `develop`; H2 branch must rebase on H1 |
| **Dependencies** | `@ob-cms/block-schema` H1 exports; optional `@ob-cms/blocks` partStyles enhancements |
| **H2 production code** | **None implemented in this audit** |
| **Working tree** | Audit branch from `develop`; H1 code read via `origin/feat/hubspot-phase-h1-design-tokens` / worktree |

### UNKNOWN items (verify at implementation)

- Exact layout `nodeId` vs UPM `nodeId` alignment for design lookup.
- Articles F2 native block target (if any).
- Phase G Button converter timeline.
- Whether `custom.hubspot` extension requires shared type in `@ob-cms/shared`.

---

*End of audit document.*
