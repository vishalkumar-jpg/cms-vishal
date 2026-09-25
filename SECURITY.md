# Security Policy

## Reporting a vulnerability

Please report security issues privately to **security@officebeacon.com** (or
Pdalal@officebeacon.com). Do **not** open a public GitHub issue for a
vulnerability. We aim to acknowledge reports within 2 business days.

When reporting, include: affected surface (public render / public form-ingest /
admin API / AI / webhook), steps to reproduce, and impact.

## Supported surfaces & what's enforced

OB-CMS is a multi-tenant CMS. The detailed control matrix, per-surface threat
model, and where each control lives in code is documented in
[`team-docs/SECURITY-HARDENING.md`](team-docs/SECURITY-HARDENING.md). In brief:

- **Tenant isolation** — global `JwtAuth → Tenant → Roles` guard chain +
  `ScopedRepository`; the active site is resolved server-side, never trusted
  from a client-supplied id.
- **Rate limiting** — Redis fixed-window limiter on auth, public form submit,
  AI generation, and a global default (returns `429` + `Retry-After`).
- **CSRF** — double-submit cookie for cookie-authenticated state-changing
  requests; Bearer-token and `@Public` (webhook/form/render) routes are exempt.
- **Headers** — `helmet` (CSP/HSTS/frameguard/noSniff/referrer) on the API;
  CSP/HSTS/Permissions-Policy on the renderer.
- **Input handling** — DTO length caps + `class-validator`, `sanitizeText`
  applied to stored marketer content, formula-injection-safe CSV exports.
- **Secrets** — encrypted-at-rest BYOK AI keys; secrets never logged; env
  validated fail-fast at boot.

## Dependency scanning

CI runs `bun audit` (see `.github/workflows/ci.yml`). Run it locally with:

```bash
bun audit --audit-level=high
```
