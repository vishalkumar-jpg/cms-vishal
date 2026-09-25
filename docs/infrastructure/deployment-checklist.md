# Deployment Checklists

Operator checklists for OB CMS platform deployments across all environments and services.

**Related:** [environment-variables.md](./environment-variables.md) · [uat-be.env.example](./uat-be.env.example) · [uat-fe.env.example](./uat-fe.env.example) · [production.env.example](./production.env.example) · [platform-deployment.md](../architecture/platform-deployment.md)

---

## Environment Overview

| Profile | `ENVIRONMENT` value | Template | Notes |
|---------|---------------------|----------|-------|
| Development | `local` | [`.env.example`](../../.env.example) | Docker Compose + local hot-reload |
| UAT | `staging` | [uat-be.env.example](./uat-be.env.example) · [uat-fe.env.example](./uat-fe.env.example) | Internal testing — **must never be indexed** |
| Production | `production` | [production.env.example](./production.env.example) | Live Office Beacon platform |

> The codebase does **not** accept `ENVIRONMENT=uat`. Use `staging` for UAT deployments.

---

## Development

- [ ] Copy [`.env.example`](../../.env.example) to `.env`
- [ ] Start backing services: `docker compose -f infra/docker-compose.yml up -d postgres redis minio mailhog`
- [ ] Run migrations: `cd apps/api && bun run db:migrate`
- [ ] Seed database: `cd apps/api && bun run db:seed`
- [ ] Install dependencies: `bun install`
- [ ] Start all apps: `bun run dev` (or `bash scripts/dev-up.sh`)
- [ ] Verify API health: `http://localhost:3001` + current health path ([`docs/api-versioning.md`](../api-versioning.md))
- [ ] Verify admin: `http://localhost:5001`
- [ ] Verify renderer: `http://localhost:3000`
- [ ] Confirm `AI_MOCK=true` or BYOK keys if testing AI features
- [ ] Confirm MailHog receives mail on port `8025`

---

## UAT

- [ ] Populate [uat-be.env.example](./uat-be.env.example) and [uat-fe.env.example](./uat-fe.env.example) — all DevOps-owned values filled
- [ ] Set `ENVIRONMENT=staging` and `NODE_ENV=production`
- [ ] Configure strong secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, `REVALIDATE_SECRET`, …)
- [ ] Set all public URLs (`ALLOWED_ORIGINS`, `APP_PUBLIC_URL`, `VITE_API_URL`, renderer URLs)
- [ ] Enable `DATABASE_SSL=true` for managed Postgres
- [ ] Set `AI_MOCK=false` for realistic integration testing
- [ ] Point `CRM_WEBHOOK_URL` at UAT CRM endpoint (not mock CRM)
- [ ] Run database migrations before app rollout
- [ ] Run seed once (or confirm super-admin exists) with rotated `SUPER_ADMIN_PASSWORD`
- [ ] **UAT no-index policy** — verify before go-live (see [`.cursor/rules/uat-indexing-policy.mdc`](../../.cursor/rules/uat-indexing-policy.mdc)):
  - [ ] Do **not** submit UAT URLs to search engines
  - [ ] Do **not** generate or expose a public UAT sitemap (`/sitemap.xml` blocked or non-indexable)
  - [ ] Block crawlers via infra (`robots.txt` disallows all when present; Cloudflare/WAF as applicable)
  - [ ] Remove search-engine verification tags (Google/Bing/etc.) from UAT HTML/meta
  - [ ] Use UAT-specific canonical URLs — **never** production canonical URLs on UAT
  - [ ] Apply `noindex, nofollow` (meta and/or `X-Robots-Tag: noindex, nofollow`) on UAT pages and API responses where applicable
  - [ ] Spot-check response headers on admin, renderer, and API origins before sign-off
- [ ] Verify admin login and site creation
- [ ] Verify renderer serves a tenant site
- [ ] Verify worker jobs process (publish → cache purge → live page)
- [ ] Verify media upload to object storage
- [ ] Verify transactional email delivery (if enabled)
- [ ] Verify Turnstile on a captcha-enabled form (if keys configured)

---

## Production

- [ ] Populate [production.env.example](./production.env.example) — all DevOps Required Values filled
- [ ] Set `ENVIRONMENT=production` — boot rejects default `JWT_SECRET`
- [ ] Rotate all secrets from UAT values
- [ ] Confirm `DATABASE_SSL=true` and connection pooling configured
- [ ] Confirm Redis AUTH and network isolation
- [ ] Confirm object storage buckets, CDN URLs, and backup retention
- [ ] Confirm CRM webhook and HMAC secret match production CRM
- [ ] Confirm mail provider credentials and `MAIL_FROM` domain alignment (SPF/DKIM)
- [ ] Run migrations in maintenance window if required
- [ ] Do **not** re-run seed unless explicitly planned
- [ ] Smoke test: login, publish page, form submit, media upload
- [ ] Confirm monitoring and backup cron jobs are scheduled
- [ ] Document rollback procedure (see [Rollback](#rollback))

---

## API (NestJS)

- [ ] `DATABASE_URL` set and reachable
- [ ] `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` reachable
- [ ] `JWT_SECRET` strong (required when `ENVIRONMENT=production`)
- [ ] `ALLOWED_ORIGINS` includes admin and renderer origins
- [ ] Object storage vars validate via `loadPlatformConfig` (see platform-deployment.md)
- [ ] `ENCRYPTION_KEY` set for AI BYOK features
- [ ] Rate limits appropriate for environment (`RATE_LIMIT_*`)
- [ ] Health check passes (path per [`docs/api-versioning.md`](../api-versioning.md))
- [ ] Swagger/OpenAPI reachable internally for SDK generation

---

## Admin (Vite SPA)

- [ ] `VITE_API_URL` points to deployed API origin (build-time)
- [ ] `APP_PUBLIC_URL` matches deployed admin URL (invite links)
- [ ] `ALLOWED_ORIGINS` on API includes admin origin
- [ ] Static assets served via CDN or container
- [ ] Admin build completed with correct env injection

---

## Renderer (Next.js)

- [ ] `NEXT_PUBLIC_API_URL` set at build time
- [ ] `INTERNAL_API_URL` set for server-side fetches (middleware, ISR)
- [ ] `REVALIDATE_SECRET` shared with worker cache-purge processor
- [ ] `RENDERER_REDIS_CACHE=true` and Redis reachable (or explicitly disabled)
- [ ] `RENDERER_ISR_REVALIDATE` tuned for environment
- [ ] Custom domains resolve via `PLATFORM_DOMAIN` / tenant DNS
- [ ] UAT: global `noindex, nofollow` enforced (see UAT indexing policy)

---

## Worker (BullMQ)

- [ ] `DATABASE_URL` and `REDIS_*` same as API
- [ ] `RENDERER_INTERNAL_URL` reachable from worker network
- [ ] `REVALIDATE_SECRET` matches renderer
- [ ] Cron schedules reviewed (`SSL_CHECK_CRON`, `BACKUP_CRON`, …)
- [ ] `PG_DUMP_BIN` / `PSQL_BIN` available in worker image for backups
- [ ] `CHROME_PATH` set if Lighthouse audits required
- [ ] CRM vars set for form delivery pipeline
- [ ] SMTP vars set for workflow notification emails

---

## PostgreSQL

- [ ] Postgres 16 compatible
- [ ] `DATABASE_URL` uses SSL in UAT/Production (`DATABASE_SSL=true`)
- [ ] Migrations applied: `bun run db:migrate`
- [ ] Connection limits appropriate for API + worker pool sizes
- [ ] Backup retention policy configured (`BACKUP_RETENTION_*`)

---

## Redis

- [ ] Redis 7 compatible
- [ ] Used by API (cache, rate limits, BullMQ), worker (queues), renderer (optional cache)
- [ ] AUTH password set in UAT/Production when exposed beyond private network
- [ ] Memory/eviction policy reviewed for cache + queue load

---

## Cloudflare

- [ ] `EDGE_PROVIDER=cloudflare` when using Cloudflare edge
- [ ] `CLOUDFLARE_ZONE_ID` set when purge or custom hostnames enabled
- [ ] DNS records point to renderer / admin / API as designed
- [ ] UAT hostnames not submitted to search engines
- [ ] TLS certificates valid for all public hostnames

---

## Turnstile

- [ ] `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` set when captcha enforcement needed
- [ ] Site key exposed to renderer via public form schema only
- [ ] Secret key stored server-side only (API `CaptchaService`)

---

## AWS S3 / Object Storage

- [ ] `OBJECT_STORAGE_PROVIDER=s3`
- [ ] `OBJECT_STORAGE_REGION` set to the actual AWS region where the bucket lives (not `auto` for native AWS S3)
- [ ] `OBJECT_STORAGE_ACCESS_KEY_ID` and `OBJECT_STORAGE_SECRET_ACCESS_KEY` set (IAM credentials)
- [ ] S3 bucket provisioned by DevOps (`OBJECT_STORAGE_BUCKET` — app does not create it)
- [ ] `OBJECT_STORAGE_PUBLIC_MEDIA_URL` points to approved CloudFront/CDN or other public media base URL when required
- [ ] `OBJECT_STORAGE_ENDPOINT` **not set** for native AWS S3 (local MinIO/R2 only); stale **`S3_ENDPOINT` removed** from deployment secret store
- [ ] Stale legacy secrets removed from deployment store: **`S3_REGION`** (including **`S3_REGION=auto`**) and **`S3_PUBLIC_URL`**
- [ ] Blank or omitted values in env templates verified — templates alone do **not** delete existing deployment secrets
- [ ] Backup bucket accessible from worker when using isolated mode
- [ ] CORS policy allows admin uploads
- [ ] **Alternative (R2):** `OBJECT_STORAGE_PROVIDER=r2` with `OBJECT_STORAGE_ENDPOINT` and `OBJECT_STORAGE_REGION=auto` when using Cloudflare R2 instead of native AWS S3

---

## SMTP / Email

- [ ] `MAIL_PROVIDER` selected (`smtp`, `resend`, or `sendgrid`)
- [ ] Provider credentials configured
- [ ] `MAIL_FROM` uses verified domain
- [ ] Test invite email, password reset, and form notification paths

---

## DNS

- [ ] Admin hostname → admin CDN / load balancer
- [ ] API hostname → API load balancer
- [ ] Renderer wildcard or per-tenant CNAMEs configured
- [ ] `PLATFORM_DOMAIN` matches CNAME target for custom domains
- [ ] ACM / Cloudflare TLS covers all public hostnames

---

## SSL

- [ ] TLS terminates at CDN or load balancer
- [ ] Worker SSL check cron enabled (`SSL_CHECK_CRON`)
- [ ] Certificate expiry monitoring in place

---

## Monitoring

- [ ] API health endpoint monitored
- [ ] Worker queue depth / failed jobs alerted
- [ ] Database connection and disk usage monitored
- [ ] Redis memory and connection count monitored
- [ ] Backup job success/failure alerted
- [ ] Page audit and link-check failures reviewed

---

## Backups

- [ ] `BACKUP_CRON` scheduled (`0 2 * * *` default)
- [ ] `BACKUP_RETENTION_KEEP` and `BACKUP_RETENTION_DAYS` appropriate
- [ ] Backup objects written to `privateBackups` storage target
- [ ] Restore procedure tested in UAT before Production reliance

---

## Rollback

- [ ] Previous container image tags retained in registry
- [ ] Database migration rollback plan documented (forward-only migrations preferred)
- [ ] Env secret previous versions retained in secret manager
- [ ] CDN cache purge plan if rollback changes published content
- [ ] Rollback smoke test checklist prepared (health, login, render, publish)

---

## Quick Reference — DevOps Secret Store

Every blank value in [uat-be.env.example](./uat-be.env.example), [uat-fe.env.example](./uat-fe.env.example), and [production.env.example](./production.env.example) must be populated before go-live. Never commit filled templates to git.
