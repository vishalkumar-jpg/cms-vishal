# CMS architecture documentation

Markdown-only architecture for OB-CMS templates, sections, components, and platform operations.

**Homepage** already exists as a full-layout preset; these docs must not imply drive-by homepage rewrites.

## Document map

| Document | PR / role |
|----------|-----------|
| [OB Live Website Audit & CMS Gap Analysis](../ob-live/website-audit-and-cms-gap-analysis.md) | PR #15 — live-site inventory & gaps |
| [Template architecture](./template-architecture.md) | PR #16 — template vs page, ownership, composition summary |
| [Shared component strategy](./shared-component-strategy.md) | PR #17 — component families & variants |
| [Section composition](./section-composition.md) | PR #18 — section families & composition rules |
| [Starter page templates](./starter-page-templates.md) | PR #19 — starter catalog & kit **contents** |
| [Template skeleton storage](./template-skeleton-storage.md) | Phase 1C — platform skeleton catalog persistence & API |
| [Template skeleton preview assets](./template-skeleton-assets.md) | Phase 1C — preview asset references for skeletons |
| [Starter Templates / template catalog](./template-catalog.md) | Phase 2D — read-only browse projection (admin: Starter Templates) |
| [Platform operations & roadmap](./cms-operations.md) | Final docs PR — registry, lifecycle, versioning, create flow, themes/i18n, runtime phases (AI deferred) |

## Reading order

1. Audit (PR #15) → why templates matter  
2. Template architecture (PR #16) → ownership invariants  
3. Shared components (PR #17) → no page-named forks  
4. Section composition (PR #18) → how pages assemble  
5. Starter templates (PR #19) → what starters exist  
6. Template skeleton storage (Phase 1C) → platform skeleton catalog persistence & API  
7. Template skeleton preview assets (Phase 1C) → preview asset references for skeletons  
8. Starter Templates / template catalog (Phase 2D) → gallery browse projection  

9. Platform operations (this completion) → how the platform manages them + implementation roadmap  

## Core invariants

- Insert/copy starters (wave 1); pages independent after create  
- Template updates never silently rewrite existing pages  
- New pages use latest **published** template version  
- Shared sync via **Reusable Blocks**, not duplicate component types  
- Prefer **family + variant** over `HomepageHero`-style forks  

## Runtime

Phased implementation roadmap: [cms-operations.md §10](./cms-operations.md).

| Phase | Package / notes |
|-------|-----------------|
| **Phase 1 — Template Registry** | `@ob-cms/template-registry` — in-memory catalog, metadata, lookup/filter (no create-page yet) |
