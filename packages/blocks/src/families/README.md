# Component families

Organizational home for the **shared component family** strategy (PR #3).

- **Contract & inventory:** [`docs/cms/shared-component-strategy.md`](../../../../docs/cms/shared-component-strategy.md)
- **Typed catalog:** `@ob-cms/block-schema` → `component-families`
- **Implementations:** remain in `packages/blocks/src/blocks/*.tsx` and the registry

## Rules

1. Prefer **one family + variants** (`Hero` + `variant="service"`).
2. Do **not** add page-named forks (`ServiceHero.tsx`, `CareerHero.tsx`).
3. Do **not** change homepage preset output in drive-by refactors.
4. Shared synchronized **content** uses Reusable Blocks; families own **rendering + contracts**.

New family-specific modules may land here in later PRs. This folder intentionally has no runtime exports yet.
