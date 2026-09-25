# Deployment 3 — Admin (CMS panel)

**Domain:** `https://uat-cms-admin.officebeacon.net` (new subdomain — must be created)
**What it is:** Vite + React 19 **static SPA** — the CMS/editor panel. Pure `dist/` of
html+js+css. No server runtime. Talks to the API with cookies.

---

## Overview

| Runtime | Build output | Serve as | Public |
|---------|--------------|----------|--------|
| static (Vite/React 19) | `apps/admin/dist/` | static host + SPA fallback | yes → `uat-cms-admin.officebeacon.net` |

**Why its own subdomain (not shared with renderer):** the renderer treats every incoming
Host as a tenant lookup (`middleware.ts:98`). Admin on a renderer host would be resolved as
"which tenant owns this domain," not served as the panel. Admin and renderer are
architecturally incompatible on one host → admin needs a dedicated subdomain.

---

## Prerequisites

- API (Deployment 1) reachable at the URL baked in at build time.
- Admin SDK (`apps/admin/src/sdk/`) **is committed** to git → no build-time API-running
  dependency. (Orval regeneration is manual only when the API contract changes.)

---

## Environment variables

### BUILD-time ONLY (Vite inlines `VITE_*` at build — nothing is read at runtime)
```env
VITE_API_URL=https://uat-cms-api.officebeacon.net
VITE_RENDERER_BASE_URL=
VITE_PLATFORM_BASE_DOMAIN=
# VITE_UNSPLASH_ACCESS_KEY=<key>        # optional — stock image search
```

> The SPA is a static bundle. `VITE_*` vars are **baked in at build**; you must
> rebuild to change them. There is no runtime env injection.
>
> Published URLs are `https://<subdomain>.<VITE_PLATFORM_BASE_DOMAIN>/<slug>`.
> `VITE_PLATFORM_BASE_DOMAIN` is an **Admin build-time** variable only — the
> platform base domain; the app prepends the tenant/site subdomain. DevOps must
> supply it to the Admin build (for example via `UAT_FRONTEND_ENV_BASE64`; see
> `docs/infrastructure/uat-fe.env.example`). It is the source of truth for
> "View published" URLs. Do **not** set it on the Renderer — the Renderer resolves
> tenants from the request Host header. `.github/workflows/frontend-deploy.yml`
> enforces `VITE_API_URL`, `VITE_RENDERER_BASE_URL`, and
> `VITE_PLATFORM_BASE_DOMAIN` before every UAT Admin build. There is no hardcoded
> in-app fallback when the value is missing or invalid.
>
> `VITE_RENDERER_BASE_URL` is a local-dev/shared-renderer fallback, used only when
> `VITE_PLATFORM_BASE_DOMAIN` is unset or invalid.

---

## Build

```bash
# Option A — direct (recommended for static hosting)
cd apps/admin
VITE_API_URL=https://uat-cms-api.officebeacon.net \
VITE_PLATFORM_BASE_DOMAIN="$VITE_PLATFORM_BASE_DOMAIN" \
  bun run build
# → produces apps/admin/dist  (upload to static host)

# Option B — container
docker build -f infra/Dockerfile.admin \
  --build-arg VITE_API_URL=https://uat-cms-api.officebeacon.net \
  --build-arg VITE_PLATFORM_BASE_DOMAIN="$VITE_PLATFORM_BASE_DOMAIN" \
  -t <registry>/cms-admin:<tag> .
```

> The `--build-arg` only works **after** the Dockerfile declares `ARG VITE_API_URL`
> (see Known blockers). The provided Dockerfile serves via `vite preview` on :5001 — a
> dev-grade static server; prefer Option A (real static host) for UAT.

---

## Deploy

```
1. Build with the UAT VITE_API_URL (above).
2. Serve apps/admin/dist from a static host (S3+CDN, nginx, Netlify, or the container).
3. SPA fallback REQUIRED — rewrite all unknown paths to /index.html so react-router works:
      nginx:  location / { try_files $uri /index.html; }
4. TLS-terminated reverse proxy for uat-cms-admin.officebeacon.net.
```

---

## Cross-cutting (why admin login can silently fail)

Admin calls API cross-subdomain with `withCredentials:true` (`AxiosService.ts:35`). On the
**API side** (Deployment 1) these must be set or login breaks:
- `ALLOWED_ORIGINS` includes `https://uat-cms-admin.officebeacon.net` (else CORS blocks login)
- `COOKIE_DOMAIN=.officebeacon.net` (else the JWT cookie isn't sent to the API subdomain)
- everything over HTTPS (cookies are `Secure`)

---

## Verify

```bash
curl -I https://uat-cms-admin.officebeacon.net/login     # 200, serves the SPA
```
Then log in with the seeded platform-admin credentials (created by `db:seed` in Deployment 1).

---

## ✅ Status — fixed & verified

Docker-tested on `linux/amd64` (commit `1bbe262`):
- `ARG VITE_API_URL` declared + passed via workflow `--build-arg`. Verified: the SPA bundle
  contains `https://uat-cms-api.officebeacon.net`, **no `localhost:3001` leak**.
- Workspace `@ob-cms/*` built in-image via `turbo run build --filter`. Verified: `vite build`
  succeeds; container serves the SPA (HTTP 200, "OB-CMS Admin").
- `.dockerignore` added.
- 🟡 The image serves via `vite preview` (fine for UAT). For prod, prefer a static host +
  SPA fallback (`try_files $uri /index.html`).

> Admin SDK paths are versioned (`/api/v1/...`); `VITE_API_URL` is host-only. Matches the API
> `GLOBAL_PREFIX=api/v1`.

## Deploy

Built + shipped by `.github/workflows/frontend-deploy.yml` to S3+CloudFront
(`uat-cms-frontend` bucket → Admin hostname) with:

- `VITE_API_URL` — DevOps-managed UAT API origin (injected at build time)
- `VITE_RENDERER_BASE_URL` — shared renderer origin fallback (injected at build time)
- `VITE_PLATFORM_BASE_DOMAIN` — platform base domain for tenant Published URLs (injected at build time)

The workflow writes the decoded `UAT_FRONTEND_ENV_BASE64` secret to `apps/admin/.env`
before building, then runs `.github/scripts/inject-uat-admin-env.sh` to ensure all
three `VITE_*` vars have the correct UAT values (overriding any stale entries in
the secret) before the Vite build runs.

**Prereqs:** same GitHub secrets + server setup as
[API + Worker](./1-API-WORKER.md#prerequisites-you-must-provide); env from
[`.env.uat.example`](../../.env.uat.example). Login needs API `ALLOWED_ORIGINS` +
`COOKIE_DOMAIN=.officebeacon.net` set (see the cross-cutting section above).

> **Container-only requirement:** If you deploy via Docker Compose (the container
> path), an nginx TLS-terminating reverse proxy from
> `uat-cms-admin.officebeacon.net` to `:5001` is required. The S3 + CloudFront
> deployment path (used by `frontend-deploy.yml`) does **not** need nginx for the
> Admin frontend — CloudFront terminates TLS and serves `dist/index.html` with
> SPA fallback directly.
