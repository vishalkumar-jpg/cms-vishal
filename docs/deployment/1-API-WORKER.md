# Deployment 1 — API + Worker

**Domain:** `https://uat-cms-api.officebeacon.net` (API only; worker has no URL)
**One deployment unit, two processes:** the NestJS API (HTTP) and the BullMQ worker
(background). They share the same database, Redis, secrets, and code — the worker is
**not** a separate deployment, it runs alongside the API on the same host/pipeline.

---

## Overview

| Process | Runtime | Start command | Port | Public |
|---------|---------|---------------|------|--------|
| api | Node 24 | `node dist/main.js` | 3001 | yes → `uat-cms-api.officebeacon.net` |
| worker | Bun | `bun run src/worker.ts` | none | no (internal BullMQ consumer) |

**Why worker rides with API:** it shares `DATABASE_URL`, `REDIS_*`, and `ENCRYPTION_KEY`,
reads/writes the same DB, and consumes queues the API produces. Confirmed crypto use:
`apps/worker/src/ai/generation.service.ts:60` (`decryptSecret` with `ENCRYPTION_KEY`),
`webhook-delivery`/`crm-delivery`/`workflow-run` processors (`signCrmPayload`).

**Migrations are owned here** — the API deployment runs DB migrations; worker never does.

---

## Prerequisites (external services)

- **PostgreSQL 16** — one database (row-level multi-tenancy, single `ob_cms` schema).
- **Redis 7** — cache + rate-limit buckets (API) and BullMQ queues (worker). Shared.
- **Object storage** (S3 / MinIO / R2) — media uploads, backups, image processing.
- **SMTP / mail provider** — invites, workflow emails.

---

## Environment variables

Required / **boot-blocking** (API exits if wrong — `apps/api/src/config/env.config.ts`):
```env
ENVIRONMENT=staging                 # enum: local|development|staging|production
DATABASE_URL=postgresql://<user>:<pass>@<pg-host>:5432/<db>
DATABASE_SSL=true                   # if managed PG requires TLS
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<redis-pass>
JWT_SECRET=<openssl rand -hex 32>          # must NOT be "change-me-in-production"
ENCRYPTION_KEY=<openssl rand -hex 32>      # 64 hex; IDENTICAL on api + worker
```

Auth / CORS / cookies (cross-subdomain — must be exact or admin login fails):
```env
GLOBAL_PREFIX=api
ALLOWED_ORIGINS=https://uat-cms-admin.officebeacon.net,https://uat-cms.officebeacon.net
COOKIE_DOMAIN=.officebeacon.net     # leading dot → cookie shared across subdomains
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
APP_PUBLIC_URL=https://uat-cms-admin.officebeacon.net   # invite/accept links
```

Storage / mail / CRM:
```env
S3_ENDPOINT=<https://...>   S3_REGION=<region>
S3_ACCESS_KEY=<key>   S3_SECRET_KEY=<secret>   S3_BUCKET=<bucket>
# S3_PUBLIC_URL=<cdn-url>                     # optional
MAIL_PROVIDER=smtp                            # smtp|resend|sendgrid|console
SMTP_HOST=<host>  SMTP_PORT=587  SMTP_USER=<u>  SMTP_PASS=<p>
# RESEND_API_KEY / SENDGRID_API_KEY           # if MAIL_PROVIDER=resend|sendgrid
CRM_WEBHOOK_URL=<crm-endpoint>   CRM_HMAC_SECRET=<secret>
```

Renderer coordination + tuning (have defaults):
```env
REVALIDATE_SECRET=<openssl rand -hex 24>      # IDENTICAL on api + worker + renderer
RENDERER_INTERNAL_URL=http://renderer:3000    # internal reach for cache purge
RATE_LIMIT_ENABLED=true                       # RATE_LIMIT_* windows/max have defaults
AI_DEFAULT_PROVIDER=claude   AI_MOCK=false    # AI_* have defaults
```

**Worker uses the same file** — needs `ENVIRONMENT`, `DATABASE_URL`, `DATABASE_SSL`,
`REDIS_*`, `ENCRYPTION_KEY` (identical), `REVALIDATE_SECRET` (identical),
`RENDERER_INTERNAL_URL`, `S3_*`, `SMTP_*`. Worker does **not** need `JWT_SECRET`,
`ALLOWED_ORIGINS`, or `COOKIE_DOMAIN`. Optional worker-only:
```env
# CHROME_PATH=<chromium>          # Lighthouse page audits
# BACKUP_CRON / RETENTION_PURGE_CRON / ... # override default cron schedules
# PG_DUMP_BIN / PSQL_BIN          # if pg client version mismatch
```

### Must be identical across services
| Secret | Shared by | Breaks if mismatched |
|--------|-----------|----------------------|
| `ENCRYPTION_KEY` | api + worker | tenant AI-key decrypt fails, AI jobs die |
| `REVALIDATE_SECRET` | api + worker + renderer | cache purge 401 → stale public pages |

---

## Build

```bash
docker build -f infra/Dockerfile.api    -t <registry>/cms-api:<tag>    .
docker build -f infra/Dockerfile.worker -t <registry>/cms-worker:<tag> .
```
Built from the **monorepo root context**. No build-time env needed (backend reads env at runtime).

---

## Deploy

```
1. Ensure Postgres + Redis + S3 + SMTP reachable.
2. Start API container (node dist/main.js, :3001) with the env above.
3. Run migrations (once per deploy):
      docker exec <api> bun run db:migrate      # idempotent
   First-time UAT bootstrap only (creates platform admin + OfficeBeacon org/site):
      docker exec <api> bun run db:seed          # DO NOT re-run on populated DB
4. Start worker container (bun run src/worker.ts) with the same env.
```

---

## Verify

```bash
curl -f https://uat-cms-api.officebeacon.net/api/health      # expect 200
docker logs <worker>                                          # "worker listening on queues: ..."
redis-cli -h <redis-host> KEYS 'ob-cms:*' | head              # queue keys present
```

---

## ✅ Status — fixed & verified

Image build/runtime issues resolved and Docker-tested on `linux/amd64`:
- Workspace `@ob-cms/*` packages now built in-image via `turbo run build --filter` (commit `fc3b10a`).
- All 7 workspace `package.json` copied in deps stage; api runtime ships the whole tree so
  bun's isolated `node_modules` resolves (commit `6d28ceb`). Verified: `reflect-metadata`,
  `@nestjs/*`, `@ob-cms/*` all resolve; boot reaches env-validation.
- Worker verified: `@ob-cms/crypto` resolves, boots and registers queues.
- `.dockerignore` added (no `.env`/host `node_modules` in images).
- Deploy workflow rewritten to the cyrano pattern + unified `docker-compose.yml` (commit `d0c23aa`).

## Deploy (how it actually runs)

Triggered by `.github/workflows/deploy-backend-uat.yml` (manual dispatch, branch input):
builds `obdev/uat-cms-{api,worker}:<short-sha>`, pushes, SSHes to the server, writes `.env`,
pulls, sed-bumps the compose image tags, `docker-compose up -d --force-recreate`, then runs
migrations via the worker image:
`docker-compose run --rm worker sh -c "cd /app/apps/api && bun run src/database/migrate.ts"`.

Postgres/Redis/object-storage are **managed external** (not in compose) — endpoints in `.env`.

## Prerequisites you must provide

**GitHub secrets:** `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `SSH_PRIVATE_KEY`,
`SERVER_HOST`, `SERVER_USER`, `SERVER_PATH`, `ENV_FILE_BASE64`.

**`ENV_FILE_BASE64`** = `base64 -w0 .env` of a UAT `.env` built from
[`.env.uat.example`](../../.env.uat.example) — managed `DATABASE_URL`/`REDIS_*`/`S3_*`
plus `JWT_SECRET`, `ENCRYPTION_KEY` (= worker), `REVALIDATE_SECRET` (= worker + renderer),
`COOKIE_DOMAIN=.officebeacon.net`, `ALLOWED_ORIGINS`, `APP_PUBLIC_URL`.

**Server:** repo cloned at `SERVER_PATH` on `develop`; `docker` + `docker-compose`;
Docker Hub `obdev` access; managed PG/Redis/S3 reachable; nginx TLS proxy
`uat-cms-api.officebeacon.net` → `:3001` (health `/api/v1/health`).
