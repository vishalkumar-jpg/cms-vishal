# Deployment 2 — Renderer (public sites)

**Domain:** `https://uat-cms.officebeacon.net`
**What it is:** Next.js 15 (App Router) **SSR** server that renders the public multi-tenant
sites. One server serves N tenant domains, resolving tenant + content **per request** from
the Host header. **SSR is required — this cannot be a static export.**

---

## Overview

| Runtime | Start command | Port | Public |
|---------|---------------|------|--------|
| Bun / Node (Next 15) | `next start -p 3000` | 3000 | yes → `uat-cms.officebeacon.net` |

**Why SSR is mandatory (evidence):**
- Tenant resolved per request from Host — `apps/renderer/src/middleware.ts:98`.
- Every page calls `resolveHost()` + `getSite(host)` at render — `app/[[...slug]]/page.tsx:52`.
- Per-visitor personalization reads cookies server-side — `lib/personalize.ts:27`.
- ISR + on-demand revalidation via `/api/revalidate` (`runtime="nodejs"`).

A static export would collapse all tenants into one build with no request context.

---

## Prerequisites

- API (Deployment 1) reachable — both at build time (URL baked in) and runtime (server fetch).
- **Redis** — renderer uses a Redis cache layer for site/page data (same Redis as API is fine).

---

## Environment variables

### BUILD-time (inlined by `next build` — MUST be set before/at build via `--build-arg`)
```env
NEXT_PUBLIC_API_URL=https://uat-cms-api.officebeacon.net
```
> `NEXT_PUBLIC_*` is baked into the JS bundle at build and also drives the CSP `connect-src`
> (`middleware.ts`). If not set at build, the public site points at `localhost:3001` and CSP
> blocks all API calls. You must rebuild per environment.

### RUNTIME
```env
RENDERER_PORT=3000
INTERNAL_API_URL=http://api:3001            # server-side (SSR/RSC) fetch, container-internal
REVALIDATE_SECRET=<hex>                     # IDENTICAL to api + worker
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<redis-pass>
# RENDERER_ISR_REVALIDATE=60                # optional, default ISR window (seconds)
# RENDERER_REDIS_CACHE=true                 # optional, cache-layer toggle (default on)
```

---

## Build

```bash
docker build -f infra/Dockerfile.renderer \
  --build-arg NEXT_PUBLIC_API_URL=https://uat-cms-api.officebeacon.net \
  -t <registry>/cms-renderer:<tag> .
```
> The `--build-arg` line only works **after** the Dockerfile is fixed to declare
> `ARG NEXT_PUBLIC_API_URL` (see Known blockers).

---

## Deploy

```
1. API deployed + reachable.
2. Start renderer container (next start, :3000) with runtime env above.
3. Put the UAT reverse proxy / LB in front, TLS-terminated, forwarding uat-cms.officebeacon.net → :3000.
```

---

## Verify

```bash
curl -I https://uat-cms.officebeacon.net/
```
**Important:** `uat-cms.officebeacon.net` is a public tenant site. It returns **404 until a
tenant/site in the DB is mapped to that host** (via admin, or seed). Once a published site
owns the host, `getSite("uat-cms.officebeacon.net")` resolves and the page renders. 404 on a
fresh DB is expected, not a failure.

---

## ✅ Status — fixed & verified

Docker-tested on `linux/amd64` (commit `e3c44df`):
- Runtime now `FROM oven/bun:1.3.8` (was `node:24-slim` → `bun: not found` crash-loop).
- `ARG NEXT_PUBLIC_API_URL` declared + passed via workflow `--build-arg`. Verified: the UAT
  API URL is baked into `.next`, **no `localhost` leak**.
- Workspace `@ob-cms/*` built in-image via `turbo run build --filter`. Verified: server boots
  (`✓ Ready in 725ms`) and runs SSR (500 only when no API is reachable — expected).
- `.dockerignore` added.
- 🟡 Not done (optional): `output: 'standalone'` — runtime copies the whole tree (~2 GB image).

## Deploy

Built + shipped by `.github/workflows/deploy-backend-uat.yml` as `obdev/uat-cms-renderer:<short-sha>`
(with `--build-arg NEXT_PUBLIC_API_URL=https://uat-cms-api.officebeacon.net`), then
`docker-compose up -d` on the server. Renderer reaches the API internally via
`INTERNAL_API_URL=http://api:3001` (compose network); `REVALIDATE_SECRET` must equal api + worker.

**Prereqs:** same GitHub secrets + server setup as
[API + Worker](./1-API-WORKER.md#prerequisites-you-must-provide); env from
[`.env.uat.example`](../../.env.uat.example). nginx TLS proxy
`uat-cms.officebeacon.net` → `:3000`. Reminder: this host must be mapped to a **tenant/site**
in the DB or it 404s (by design).
