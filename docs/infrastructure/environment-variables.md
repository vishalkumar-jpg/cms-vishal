# Environment Variables

Canonical reference for every configuration variable used by the OB CMS monorepo.

**Related docs:** [`.env.example`](../../.env.example) · [`uat-be.env.example`](./uat-be.env.example) · [`uat-fe.env.example`](./uat-fe.env.example) · [`uat.env.example`](./uat.env.example) (pointer) · [`production.env.example`](./production.env.example) · [`deployment-checklist.md`](./deployment-checklist.md) · [`packages/config/src/env.ts`](../../packages/config/src/env.ts) · [`packages/config/src/platform-config.ts`](../../packages/config/src/platform-config.ts) · [`docs/architecture/platform-deployment.md`](../architecture/platform-deployment.md) · [`docs/architecture/platform-configuration.md`](../architecture/platform-configuration.md)

---

## Purpose

This document is the **single source of truth** for every environment variable required by:

- **Development** — local machines and Docker Compose
- **UAT** — internal testing (values owned by DevOps)
- **Production** — live Office Beacon platform (values owned by DevOps)

Developers document **what** variables exist, whether they are required, and their safe defaults. DevOps owns actual secret values and deployment-specific URLs for UAT and Production.

**Every PR that introduces, removes, renames, or changes an environment variable MUST update this document** (see [PR Requirements](#pr-requirements)).

---

## Environment Matrix

Summary of all discovered variables. Secret values are intentionally blank in every column.

| Variable | Dev | UAT | Prod | Required | Secret | Default | Description |
|----------|-----|-----|------|----------|--------|---------|-------------|
| `ACCESS_TOKEN_EXPIRY` | `15m` | | | No | No | `15m` | JWT access-token lifetime |
| `AI_DEFAULT_PROVIDER` | `claude` | | | No | No | `claude` | Default LLM provider (`claude`, `openai`, `gemini`) |
| `AI_MOCK` | `false` | | | No | No | `false` | Offline AI mock provider (no real API keys) |
| `AI_MOCK_BAD_FIRST` | `false` | | | No | No | `false` | Mock provider emits one invalid layout before a valid one |
| `AI_MONTHLY_COST_CEILING_MICRO` | `50000000` | | | No | No | `50000000` | Per-tenant monthly AI cost ceiling (micro-dollars) |
| `AI_MONTHLY_TOKEN_CEILING` | `5000000` | | | No | No | `5000000` | Per-tenant monthly AI token ceiling |
| `AI_RATE_PER_MIN` | `10` | | | No | No | `10` | Per-tenant AI requests per minute |
| `ALLOWED_ORIGINS` | `http://localhost:5001,http://localhost:3000` | | | No | No | `""` | CORS allowed origins (comma-separated) |
| `ANALYTICS_ROLLUP_CRON` | | | | No | No | `0 * * * *` | Cron schedule for analytics rollup job |
| `ANALYTICS_ROLLUP_LOOKBACK_HOURS` | | | | No | No | `48` | Hours of raw events to re-aggregate |
| `API_PORT` | `3001` | | | No | No | `3001` | NestJS API listen port |
| `APP_PUBLIC_URL` | `http://localhost:5001` | | | No | No | `http://localhost:5001` | Public admin SPA base URL (invite links) |
| `AUDIT_BASE_URL` | | | | No | No | falls back to renderer URLs | Public origin for page audits / Lighthouse |
| `AUTH0_AUDIENCE` | | | | When Auth0 enabled | No | `""` | Auth0 API audience |
| `AUTH0_CLIENT_ID` | | | | When Auth0 enabled | No | `""` | Auth0 application client ID |
| `AUTH0_DOMAIN` | | | | When Auth0 enabled | No | `""` | Auth0 tenant domain |
| `AUTH0_ENABLED` | `false` | | | No | No | `false` | Enable Auth0 adapter (currently inert stub) |
| `BACKUP_CRON` | | | | No | No | `0 2 * * *` | Cron schedule for database backups |
| `BACKUP_RETENTION_DAYS` | | | | No | No | `30` | Delete backup objects older than N days |
| `BACKUP_RETENTION_KEEP` | | | | No | No | `7` | Minimum number of recent backups to retain |
| `CHROME_PATH` | | | | No | No | system Chrome | Path to Chrome/Chromium for Lighthouse audits |
| `CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED` | | | | No | No | `false` | Enable Cloudflare Custom Hostnames capability (config only) |
| `CLOUDFLARE_PURGE_ENABLED` | | | | No | No | `false` | Enable Cloudflare cache purge capability (config only) |
| `CLOUDFLARE_ZONE_ID` | | | | When CF capabilities enabled | No | — | Cloudflare zone ID |
| `CONTENT_EXPIRY_CRON` | | | | No | No | `* * * * *` | Cron schedule for content expiry sweep |
| `COOKIE_DOMAIN` | `localhost` | | | No | No | `localhost` | Cookie domain for session cookies |
| `CRM_HMAC_SECRET` | | | | No | Yes | — | HMAC secret for CRM webhook signing |
| `CRM_LEGACY_URL` | | | | No | No | — | Legacy HubSpot URL for dual-write cutover |
| `CRM_MOCK_SECRET` | | | | No | Yes | — | Shared secret for local mock CRM receiver |
| `CRM_WEBHOOK_URL` | `http://localhost:3001/api/dev/mock-crm` | | | No | No | mock CRM URL | Default CRM delivery webhook URL |
| `DATABASE_HOST` | `localhost` | | | When `DATABASE_URL` unset | No | — | Postgres host (worker fallback) |
| `DATABASE_NAME` | `obcms` | | | When `DATABASE_URL` unset | No | — | Postgres database name |
| `DATABASE_PASSWORD` | | | | When `DATABASE_URL` unset | Yes | — | Postgres password |
| `DATABASE_PORT` | `5433` | | | When `DATABASE_URL` unset | No | `5433` | Postgres port |
| `DATABASE_SSL` | `false` | | | No | No | `false` | Enable TLS for Postgres connections |
| `DATABASE_URL` | `postgresql://obcms:obcms@localhost:5433/obcms` | | | **Yes** | Yes | — | Primary Postgres connection string |
| `DATABASE_USER` | `obcms` | | | When `DATABASE_URL` unset | No | — | Postgres username |
| `EDGE_PROVIDER` | | | | No | No | `none` | CDN edge provider (`none`, `cloudfront`, `cloudflare`) |
| `ENCRYPTION_KEY` | | | | Prod recommended | Yes | — | AES-256-GCM key for tenant BYOK secrets |
| `ENVIRONMENT` | `local` | `staging` | `production` | **Yes** | No | `local` | Runtime environment label |
| `GLOBAL_PREFIX` | `api/v1` | | | No | No | `api/v1` | Optional local override only — **excluded from UAT/Prod deployment templates**; version prefix is code-managed ([`docs/api-versioning.md`](../api-versioning.md)) |
| `INTERNAL_API_URL` | | | | No | No | `http://localhost:3001` | Server-side API origin (renderer middleware) |
| `JWT_SECRET` | | | | **Yes (prod)** | Yes | `change-me-in-production` | JWT signing secret |
| `KMS_DATA_KEY` | | | | No | Yes | — | Fallback name for encryption key (future KMS) |
| `LINK_CHECK_CONCURRENCY` | | | | No | No | `8` | Parallel link-check fetches |
| `LINK_CHECK_MAX_LINKS` | | | | No | No | `300` | Max links per link-check run |
| `LINK_CHECK_MAX_PAGES` | | | | No | No | `50` | Max pages scanned per link-check run |
| `LINK_CHECK_TIMEOUT_MS` | | | | No | No | `8000` | Per-link fetch timeout (ms) |
| `MAIL_FROM` | | | | No | No | `OB-CMS <no-reply@officebeacon.com>` | Default From header for outbound mail |
| `MAIL_HOST` | | | | No | No | — | SMTP host alias (worker workflow emails) |
| `MAIL_PROVIDER` | `smtp` | | | No | No | `smtp` | Mail backend (`smtp`, `resend`, `sendgrid`, `console`) |
| `MAIL_SMTP_SECURE` | | | | No | No | `false` | Implicit TLS for SMTP (port 465) |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | | | Docker only | Yes | — | MinIO root password (Compose) |
| `MINIO_ROOT_USER` | `minioadmin` | | | Docker only | No | — | MinIO root user (Compose) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | | | No | No | — | Public API URL baked into renderer client bundle |
| `NODE_ENV` | `development` | | | No | No | — | Node.js runtime mode |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | | | | When R2 / isolated | Yes | `minioadmin` (local) | Object storage access key |
| `OBJECT_STORAGE_BUCKET` | | | | No | No | `ob-cms-media` | Shared-mode bucket name |
| `OBJECT_STORAGE_ENDPOINT` | | | | When minio/r2 | No | — | S3-compatible endpoint URL |
| `OBJECT_STORAGE_MODE` | | | | No | No | `shared` | Storage layout (`shared`, `isolated`) |
| `OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET` | | | | When isolated | No | — | Isolated backups bucket |
| `OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET` | | | | When isolated | No | — | Isolated form attachments bucket |
| `OBJECT_STORAGE_PROVIDER` | | | | No | No | `s3` | Storage provider (`s3`, `minio`, `r2`) |
| `OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET` | | | | When isolated | No | — | Isolated public media bucket |
| `OBJECT_STORAGE_PUBLIC_MEDIA_URL` | | | | No | No | — | Public CDN/base URL for media |
| `OBJECT_STORAGE_REGION` | | | | No | No | `us-east-1` / `auto` (R2) | Object storage region |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | | | | When R2 / isolated | Yes | `minioadmin` (local) | Object storage secret key |
| `OB_HOME_SLUG` | | | | No | No | `ob-homepage` | Publish script: homepage slug |
| `OB_LAYOUT_PATH` | | | | No | No | — | Publish script: layout JSON path |
| `OB_PAGE_SLUG` | | | | No | No | `how-it-works` | Publish script: page slug |
| `OB_PAGE_TITLE` | | | | No | No | `How It Works` | Publish script: page title |
| `OB_SITE_SUBDOMAIN` | | | | No | No | `officebeacon` | Publish script: site subdomain |
| `PAGE_AUDIT_MAX_PAGES` | | | | No | No | `50` | Max pages per bulk audit run |
| `PAGE_AUDIT_SCHEDULE_CRON` | | | | No | No | `0 * * * *` | Cron schedule for scheduled page audits |
| `PAGE_AUDIT_STALE_MS` | | | | No | No | derived | Stale audit threshold (ms) |
| `PAGE_AUDIT_TIMEOUT_MS` | | | | No | No | `60000` | Single page audit timeout (ms) |
| `PG_DUMP_BIN` | `pg_dump` | | | No | No | `pg_dump` | Path to `pg_dump` binary |
| `PLATFORM_BASE_DOMAIN` | | | | No | No | — | Platform-wide base domain for audit URL resolution |
| `PLATFORM_DOMAIN` | | | | No | No | `app.ob-cms.local` | CNAME target for custom domain routing |
| `POSTGRES_DB` | `obcms` | | | Docker only | No | — | Postgres database (Compose) |
| `POSTGRES_PASSWORD` | | | | Docker only | Yes | — | Postgres password (Compose) |
| `POSTGRES_USER` | `obcms` | | | Docker only | No | — | Postgres user (Compose) |
| `PREVIEW_TOKEN_SECRET` | | | | No | Yes | falls back to `ENCRYPTION_KEY` / `JWT_SECRET` | HMAC secret for preview-lock tokens |
| `PROFILE_REBUILD_LOOKBACK_HOURS` | | | | No | No | `720` | Identity profile rebuild event window |
| `PSQL_BIN` | `psql` | | | No | No | `psql` | Path to `psql` binary |
| `RATE_LIMIT_AI_MAX` | `5` | | | No | No | `5` | AI generate per-minute cap (per tenant) |
| `RATE_LIMIT_AI_MONTHLY_MAX` | `500` | | | No | No | `500` | AI generate monthly cap (per tenant) |
| `RATE_LIMIT_AI_WINDOW` | `60` | | | No | No | `60` | AI rate-limit window (seconds) |
| `RATE_LIMIT_AUTH_MAX` | `10` | | | No | No | `10` | Auth endpoint max requests per window |
| `RATE_LIMIT_AUTH_WINDOW` | `60` | | | No | No | `60` | Auth rate-limit window (seconds) |
| `RATE_LIMIT_ENABLED` | `true` | | | No | No | `true` | Master rate-limit toggle |
| `RATE_LIMIT_FORM_MAX` | `10` | | | No | No | `10` | Public form submit max per window |
| `RATE_LIMIT_FORM_WINDOW` | `60` | | | No | No | `60` | Form rate-limit window (seconds) |
| `RATE_LIMIT_GLOBAL_MAX` | `300` | | | No | No | `300` | Global API max requests per window |
| `RATE_LIMIT_GLOBAL_WINDOW` | `60` | | | No | No | `60` | Global rate-limit window (seconds) |
| `RAW_EVENT_RETENTION_DAYS` | | | | No | No | `400` | Raw analytics event retention |
| `REDIS_HOST` | `localhost` | | | No | No | `localhost` | Redis hostname |
| `REDIS_PASSWORD` | | | | No | Yes | — | Redis password |
| `REDIS_PORT` | `6379` | | | No | No | `6379` | Redis port |
| `REFRESH_TOKEN_EXPIRY` | `7d` | | | No | No | `7d` | Refresh-token lifetime |
| `RENDERER_BASE_DOMAIN` | | | | No | No | `localhost:3000` | Host used when building public page URLs |
| `RENDERER_BASE_URL` | | | | No | No | — | Public renderer origin (audit fallback) |
| `RENDERER_INTERNAL_URL` | `http://localhost:3000` | | | No | No | `http://localhost:3000` | Renderer origin reachable from worker |
| `RENDERER_ISR_REVALIDATE` | | | | No | No | `60` | ISR revalidation interval (seconds) |
| `RENDERER_PORT` | `3000` | | | No | No | `3000` | Next.js renderer listen port |
| `RENDERER_REDIRECT_TTL` | | | | No | No | `30` | Redirect lookup cache TTL (seconds) |
| `RENDERER_REDIS_CACHE` | | | | No | No | `true` | Enable renderer Redis cache layer |
| `RESEND_API_KEY` | | | | When `MAIL_PROVIDER=resend` | Yes | — | Resend API key |
| `RETENTION_PURGE_CRON` | | | | No | No | `0 3 * * *` | Cron schedule for retention purge |
| `REVALIDATE_SECRET` | | | | Recommended | Yes | — | Shared secret for on-demand ISR revalidation |
| `S3_ACCESS_KEY` | `minioadmin` | | | No | Yes | `minioadmin` (local) | Legacy S3 access key |
| `S3_BUCKET` | `ob-cms-media` | | | No | No | `ob-cms-media` | Legacy S3 bucket name |
| `S3_ENDPOINT` | `http://localhost:9000` | | | No | No | — | Legacy S3 endpoint (MinIO locally) |
| `S3_PUBLIC_URL` | | | | No | No | — | Legacy public media base URL |
| `S3_REGION` | `us-east-1` | | | No | No | `us-east-1` | Legacy S3 region |
| `S3_SECRET_KEY` | | | | No | Yes | `minioadmin` (local) | Legacy S3 secret key |
| `SCHEDULED_PUBLISH_CRON` | | | | No | No | `* * * * *` | Cron schedule for scheduled publish sweep |
| `SENDGRID_API_KEY` | | | | When `MAIL_PROVIDER=sendgrid` | Yes | — | SendGrid API key |
| `SMTP_HOST` | `localhost` | | | No | No | `localhost` | SMTP server hostname |
| `SMTP_PASS` | | | | When SMTP auth required | Yes | — | SMTP password |
| `SMTP_PORT` | `1025` | | | No | No | `1025` | SMTP server port |
| `SMTP_USER` | | | | When SMTP auth required | No | — | SMTP username |
| `SSL_CHECK_CRON` | | | | No | No | `0 4 * * *` | Cron schedule for SSL certificate checks |
| `SSL_CHECK_TIMEOUT_MS` | | | | No | No | `8000` | TLS handshake timeout (ms) |
| `SUPER_ADMIN_EMAIL` | `admin@officebeacon.com` | | | No | No | `admin@officebeacon.com` | Seed script super-admin email |
| `SUPER_ADMIN_PASSWORD` | | | | No | Yes | `ChangeMe123!` | Seed script super-admin password |
| `TURNSTILE_SECRET_KEY` | | | | When captcha enforced | Yes | — | Cloudflare Turnstile secret (server-side) |
| `TURNSTILE_SITE_KEY` | | | | When captcha enforced | No | — | Cloudflare Turnstile site key (public) |
| `VITE_API_URL` | `http://localhost:3001` | | | No | No | `http://localhost:3001` | Admin SPA API base URL |
| `VITE_APP_PORT` | `5001` | | | No | No | `5001` | Admin Vite dev/preview port |
| `VITE_ENVIRONMENT` | `local` | `staging` | | No | No | `local` | Build-time environment label exposed to the Admin bundle via Vite. When set to `staging`, `siteOriginUrl()` fails closed (returns null) instead of generating production-style tenant URLs when `VITE_RENDERER_BASE_URL` is missing or invalid. | `local` | | DevOps |
| `VITE_ORVAL_API_URL` | `http://localhost:3001` | | | No | No | `http://localhost:3001` | OpenAPI spec URL for Orval codegen |
| `VITE_PLATFORM_BASE_DOMAIN` | | | | No | No | — | Build-time Admin SPA platform base domain for tenant Published URLs (`https://<subdomain>.<value>`). **DevOps-owned** — supplied externally at build time. No hardcoded default. Missing/blank/invalid values produce no platform-domain URL; `siteOriginUrl()` may fall back to `VITE_RENDERER_BASE_URL`. Validation by `getPlatformBaseDomain()`: leading/trailing whitespace trimmed; internal whitespace rejected; optional `http://`/`https://` stripped; trailing `/` removed; credentials, paths, queries, fragments, and malformed host/port rejected; valid explicit ports accepted; explicit `:443` preserved; zero-padded numeric ports normalized to canonical values. |
| `VITE_UNSPLASH_ACCESS_KEY` | | | | No | Yes | — | Unsplash API key for stock image search |
| `WORKER_PORT` | `3011` | | | No | No | `3011` | Worker health/metrics port reference |

---

## Categories

### Application

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `ENVIRONMENT` | Yes | No | `local` | Runtime label; boot validation accepts `local`, `development`, `staging`, `production` | `local` | | |
| `API_PORT` | No | No | `3001` | NestJS API listen port | `3001` | | |
| `WORKER_PORT` | No | No | `3011` | Worker port reference | `3011` | | |
| `GLOBAL_PREFIX` | No | No | `api/v1` | Optional local override; **do not set in UAT/Prod deployments** — see [`docs/api-versioning.md`](../api-versioning.md) | `api/v1` (local only) | — | — |
| `ALLOWED_ORIGINS` | No | No | `""` | CORS allowed origins (comma-separated) | see matrix | | |
| `APP_PUBLIC_URL` | No | No | `http://localhost:5001` | Public admin URL for invitation accept links | `http://localhost:5001` | | DevOps |
| `PLATFORM_DOMAIN` | No | No | `app.ob-cms.local` | CNAME target hostname for tenant custom domains | | | DevOps |
| `PLATFORM_BASE_DOMAIN` | No | No | — | Platform base domain for audit URL construction | | | DevOps |
| `NODE_ENV` | No | No | — | Standard Node.js environment (`development`, `production`, …) | `development` | | |

### Database

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `DATABASE_URL` | **Yes** | Yes | — | Primary Postgres connection string (API, worker, scripts) | see matrix | | DevOps |
| `DATABASE_SSL` | No | No | `false` | Enable TLS for Postgres | `false` | | DevOps |
| `DATABASE_HOST` | No* | No | — | Postgres host when `DATABASE_URL` is not used | `localhost` | | |
| `DATABASE_PORT` | No* | No | `5433` | Postgres port when `DATABASE_URL` is not used | `5433` | | |
| `DATABASE_USER` | No* | No | — | Postgres user when `DATABASE_URL` is not used | `obcms` | | |
| `DATABASE_PASSWORD` | No* | Yes | — | Postgres password when `DATABASE_URL` is not used | | | DevOps |
| `DATABASE_NAME` | No* | No | — | Postgres database when `DATABASE_URL` is not used | `obcms` | | |
| `POSTGRES_USER` | Docker | No | — | Postgres user for Docker Compose service only | `obcms` | | |
| `POSTGRES_PASSWORD` | Docker | Yes | — | Postgres password for Docker Compose service only | | | |
| `POSTGRES_DB` | Docker | No | — | Postgres database for Docker Compose service only | `obcms` | | |

\* Required by the worker when `DATABASE_URL` is absent.

### Redis

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `REDIS_HOST` | No | No | `localhost` | Redis hostname (API, worker, renderer cache) | `localhost` | | DevOps |
| `REDIS_PORT` | No | No | `6379` | Redis port | `6379` | | |
| `REDIS_PASSWORD` | No | Yes | — | Redis AUTH password | | | DevOps |

### Authentication

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `AUTH0_ENABLED` | No | No | `false` | Enable Auth0 adapter (stub until creds provided) | `false` | | |
| `AUTH0_DOMAIN` | When Auth0 | No | `""` | Auth0 tenant domain | | | DevOps |
| `AUTH0_CLIENT_ID` | When Auth0 | No | `""` | Auth0 application client ID | | | DevOps |
| `AUTH0_AUDIENCE` | When Auth0 | No | `""` | Auth0 API audience | | | DevOps |
| `COOKIE_DOMAIN` | No | No | `localhost` | Session cookie domain | `localhost` | | DevOps |
| `SUPER_ADMIN_EMAIL` | No | No | `admin@officebeacon.com` | Initial super-admin email (seed only) | see matrix | | DevOps |
| `SUPER_ADMIN_PASSWORD` | No | Yes | `ChangeMe123!` | Initial super-admin password (seed only) | | | DevOps |

### JWT

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `JWT_SECRET` | **Yes (prod)** | Yes | `change-me-in-production` | JWT signing secret for session tokens | | | DevOps |
| `ACCESS_TOKEN_EXPIRY` | No | No | `15m` | Access-token JWT lifetime | `15m` | | |
| `REFRESH_TOKEN_EXPIRY` | No | No | `7d` | Refresh-token lifetime | `7d` | | |
| `PREVIEW_TOKEN_SECRET` | No | Yes | falls back to `ENCRYPTION_KEY` / `JWT_SECRET` | HMAC secret for preview-lock tokens | | | DevOps |

### Email

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `MAIL_PROVIDER` | No | No | `smtp` | Provider: `smtp`, `resend`, `sendgrid`, `console` | `smtp` | | DevOps |
| `MAIL_FROM` | No | No | `OB-CMS <no-reply@officebeacon.com>` | Default From header | | | DevOps |
| `SMTP_HOST` | No | No | `localhost` | SMTP server hostname | `localhost` | | DevOps |
| `SMTP_PORT` | No | No | `1025` | SMTP server port | `1025` | | |
| `SMTP_USER` | No | No | — | SMTP username | | | DevOps |
| `SMTP_PASS` | No | Yes | — | SMTP password | | | DevOps |
| `MAIL_SMTP_SECURE` | No | No | `false` | Implicit TLS (port 465) | | | |
| `MAIL_HOST` | No | No | — | SMTP host alias used by worker workflow emails | | | |
| `RESEND_API_KEY` | When resend | Yes | — | Resend HTTP API key | | | DevOps |
| `SENDGRID_API_KEY` | When sendgrid | Yes | — | SendGrid HTTP API key | | | DevOps |

### Object Storage (S3 / R2 / MinIO)

Legacy `S3_*` variables remain supported. Provider-neutral `OBJECT_STORAGE_*` variables take precedence when set. See [`platform-deployment.md`](../architecture/platform-deployment.md).

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `S3_ENDPOINT` | No | No | — | Legacy S3-compatible endpoint | `http://localhost:9000` | | DevOps |
| `S3_REGION` | No | No | `us-east-1` | Legacy S3 region | `us-east-1` | | |
| `S3_ACCESS_KEY` | No | Yes | `minioadmin` | Legacy access key | | | DevOps |
| `S3_SECRET_KEY` | No | Yes | `minioadmin` | Legacy secret key | | | DevOps |
| `S3_BUCKET` | No | No | `ob-cms-media` | Legacy shared bucket | `ob-cms-media` | | DevOps |
| `S3_PUBLIC_URL` | No | No | — | Legacy public media base URL | | | DevOps |
| `OBJECT_STORAGE_PROVIDER` | No | No | `s3` | Provider: `s3`, `minio`, `r2` | | | DevOps |
| `OBJECT_STORAGE_MODE` | No | No | `shared` | Layout: `shared` or `isolated` | | | DevOps |
| `OBJECT_STORAGE_ENDPOINT` | When minio/r2 | No | — | S3-compatible endpoint | | | DevOps |
| `OBJECT_STORAGE_REGION` | No | No | `us-east-1` / `auto` | Storage region | | | |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | When r2 | Yes | `minioadmin` | Access key ID | | | DevOps |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | When r2 | Yes | `minioadmin` | Secret access key | | | DevOps |
| `OBJECT_STORAGE_BUCKET` | No | No | `ob-cms-media` | Shared-mode bucket | | | DevOps |
| `OBJECT_STORAGE_PUBLIC_MEDIA_URL` | No | No | — | Public CDN URL for media | | | DevOps |
| `OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET` | When isolated | No | — | Isolated public media bucket | | | DevOps |
| `OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET` | When isolated | No | — | Isolated private forms bucket | | | DevOps |
| `OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET` | When isolated | No | — | Isolated private backups bucket | | | DevOps |
| `MINIO_ROOT_USER` | Docker | No | — | MinIO root user (Compose only) | `minioadmin` | | |
| `MINIO_ROOT_PASSWORD` | Docker | Yes | — | MinIO root password (Compose only) | | | |

### Cloudflare

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `EDGE_PROVIDER` | No | No | `none` | CDN provider selection | | | DevOps |
| `CLOUDFLARE_PURGE_ENABLED` | No | No | `false` | Cache purge capability flag (config only in PR 1) | | | DevOps |
| `CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED` | No | No | `false` | Custom Hostnames capability flag (config only) | | | DevOps |
| `CLOUDFLARE_ZONE_ID` | When CF enabled | No | — | Cloudflare zone ID | | | DevOps |
| `TURNSTILE_SECRET_KEY` | When captcha | Yes | — | Turnstile server-side verification secret | | | DevOps |
| `TURNSTILE_SITE_KEY` | When captcha | No | — | Turnstile public site key (surfaced to renderer) | | | DevOps |

### CDN

Reserved for future CDN-specific variables beyond `EDGE_PROVIDER` and Cloudflare flags. Append new rows here rather than reorganizing.

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| — | — | — | — | *No additional CDN-only variables discovered yet.* | | | |

### Renderer

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `RENDERER_PORT` | No | No | `3000` | Next.js listen port | `3000` | | |
| `NEXT_PUBLIC_API_URL` | No | No | — | Public API URL (client bundle) | `http://localhost:3001` | | DevOps |
| `INTERNAL_API_URL` | No | No | `http://localhost:3001` | Server-side API origin | | | DevOps |
| `RENDERER_ISR_REVALIDATE` | No | No | `60` | ISR revalidation interval (seconds) | | | |
| `RENDERER_REDIRECT_TTL` | No | No | `30` | Redirect lookup cache TTL (seconds) | | | |
| `RENDERER_REDIS_CACHE` | No | No | `true` | Enable Redis cache layer (`false` disables) | | | |
| `REVALIDATE_SECRET` | Recommended | Yes | — | On-demand ISR revalidation shared secret | | | DevOps |
| `RENDERER_INTERNAL_URL` | No | No | `http://localhost:3000` | Renderer origin reachable from worker | `http://localhost:3000` | | DevOps |
| `RENDERER_BASE_URL` | No | No | — | Public renderer origin (audit fallback chain) | | | DevOps |
| `RENDERER_BASE_DOMAIN` | No | No | `localhost:3000` | Host for building public page/blog URLs | | | DevOps |
| `AUDIT_BASE_URL` | No | No | renderer fallback | Public origin for Lighthouse page audits | | | DevOps |

### Worker

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `SSL_CHECK_CRON` | No | No | `0 4 * * *` | SSL certificate check schedule | | | DevOps |
| `PAGE_AUDIT_SCHEDULE_CRON` | No | No | `0 * * * *` | Scheduled page audit sweep | | | DevOps |
| `RETENTION_PURGE_CRON` | No | No | `0 3 * * *` | Analytics retention purge schedule | | | |
| `CONTENT_EXPIRY_CRON` | No | No | `* * * * *` | Content expiry sweep schedule | | | |
| `SCHEDULED_PUBLISH_CRON` | No | No | `* * * * *` | Scheduled publish sweep | | | |
| `ANALYTICS_ROLLUP_CRON` | No | No | `0 * * * *` | Analytics rollup schedule | | | |
| `BACKUP_CRON` | No | No | `0 2 * * *` | Database backup schedule | | | DevOps |
| `BACKUP_RETENTION_KEEP` | No | No | `7` | Minimum recent backups to retain | | | |
| `BACKUP_RETENTION_DAYS` | No | No | `30` | Delete backups older than N days | | | |
| `PG_DUMP_BIN` | No | No | `pg_dump` | Path to `pg_dump` | `pg_dump` | | |
| `PSQL_BIN` | No | No | `psql` | Path to `psql` | `psql` | | |
| `CHROME_PATH` | No | No | system Chrome | Chrome/Chromium path for Lighthouse | | | DevOps |
| `CRM_WEBHOOK_URL` | No | No | mock CRM | Default CRM delivery webhook | see matrix | | DevOps |
| `CRM_HMAC_SECRET` | No | Yes | — | CRM webhook HMAC signing secret | | | DevOps |
| `CRM_MOCK_SECRET` | No | Yes | — | Local mock CRM receiver secret | | | |
| `CRM_LEGACY_URL` | No | No | — | Legacy HubSpot URL for dual-write | | | DevOps |

### Analytics

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `ANALYTICS_ROLLUP_LOOKBACK_HOURS` | No | No | `48` | Hours of raw events to re-aggregate | | | |
| `RAW_EVENT_RETENTION_DAYS` | No | No | `400` | Raw analytics event retention period | | | |
| `PROFILE_REBUILD_LOOKBACK_HOURS` | No | No | `720` | Identity profile rebuild event window | | | |

### Security

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `RATE_LIMIT_ENABLED` | No | No | `true` | Master rate-limit enforcement toggle | `true` | | |
| `RATE_LIMIT_GLOBAL_WINDOW` | No | No | `60` | Global window (seconds) | `60` | | |
| `RATE_LIMIT_GLOBAL_MAX` | No | No | `300` | Global max requests per window | `300` | | |
| `RATE_LIMIT_AUTH_WINDOW` | No | No | `60` | Auth endpoints window (seconds) | `60` | | |
| `RATE_LIMIT_AUTH_MAX` | No | No | `10` | Auth endpoints max per window | `10` | | |
| `RATE_LIMIT_FORM_WINDOW` | No | No | `60` | Form submit window (seconds) | `60` | | |
| `RATE_LIMIT_FORM_MAX` | No | No | `10` | Form submit max per window | `10` | | |
| `RATE_LIMIT_AI_WINDOW` | No | No | `60` | AI generate window (seconds) | `60` | | |
| `RATE_LIMIT_AI_MAX` | No | No | `5` | AI generate max per minute (per tenant) | `5` | | |
| `RATE_LIMIT_AI_MONTHLY_MAX` | No | No | `500` | AI generate monthly cap (per tenant) | `500` | | |
| `ENCRYPTION_KEY` | Prod recommended | Yes | — | AES-256-GCM key for tenant BYOK API keys | | | DevOps |
| `KMS_DATA_KEY` | No | Yes | — | Accepted fallback name for encryption key | | | DevOps |

### Feature Flags

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `AUTH0_ENABLED` | No | No | `false` | Auth0 adapter toggle | `false` | | |
| `AI_MOCK` | No | No | `false` | Offline AI mock provider | `false` | | |
| `AI_MOCK_BAD_FIRST` | No | No | `false` | Mock emits invalid layout before valid | `false` | | |
| `RENDERER_REDIS_CACHE` | No | No | `true` | Renderer Redis cache toggle | | | |

### Third-party Integrations

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `AI_DEFAULT_PROVIDER` | No | No | `claude` | Default LLM provider | `claude` | | |
| `AI_RATE_PER_MIN` | No | No | `10` | Per-tenant AI rate limit | `10` | | |
| `AI_MONTHLY_TOKEN_CEILING` | No | No | `5000000` | Monthly token ceiling | `5000000` | | |
| `AI_MONTHLY_COST_CEILING_MICRO` | No | No | `50000000` | Monthly cost ceiling (micro-dollars) | `50000000` | | |
| `VITE_UNSPLASH_ACCESS_KEY` | No | Yes | — | Unsplash API key (admin stock search) | | | DevOps |
| `TURNSTILE_SITE_KEY` | When captcha | No | — | Cloudflare Turnstile public key | | | DevOps |
| `TURNSTILE_SECRET_KEY` | When captcha | Yes | — | Cloudflare Turnstile secret | | | DevOps |

### Build / Runtime

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `VITE_API_URL` | No | No | `http://localhost:3001` | Admin SPA API base URL (build-time) | `http://localhost:3001` | | DevOps |
| `VITE_ENVIRONMENT` | No | No | `local` | Build-time environment label exposed to the Admin bundle via Vite. When set to `staging`, `siteOriginUrl()` fails closed (returns null) instead of generating production-style tenant URLs when `VITE_RENDERER_BASE_URL` is missing or invalid. | `local` | `staging` | DevOps |
| `VITE_PLATFORM_BASE_DOMAIN` | No | No | — | Build-time Admin SPA platform base domain for tenant Published URLs (`https://<subdomain>.<value>`). **DevOps-owned** — supplied externally at build time. No hardcoded default. Missing/blank/invalid values produce no platform-domain URL; `siteOriginUrl()` may fall back to `VITE_RENDERER_BASE_URL`. Validation by `getPlatformBaseDomain()`: leading/trailing whitespace trimmed; internal whitespace rejected; optional `http://`/`https://` stripped; trailing `/` removed; credentials, paths, queries, fragments, and malformed host/port rejected; valid explicit ports accepted; explicit `:443` preserved; zero-padded numeric ports normalized to canonical values. | | | |
| `VITE_ORVAL_API_URL` | No | No | `http://localhost:3001` | OpenAPI spec URL for Orval codegen | `http://localhost:3001` | | |
| `VITE_APP_PORT` | No | No | `5001` | Admin Vite dev/preview port | `5001` | | |
| `NEXT_PUBLIC_API_URL` | No | No | — | Renderer public API URL (build-time) | `http://localhost:3001` | | DevOps |
| `NODE_ENV` | No | No | — | Node.js runtime mode | `development` | | |

### Logging

Reserved for future logging configuration. Append new rows here rather than reorganizing.

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| — | — | — | — | *No dedicated logging env vars discovered yet.* | | | |

### Monitoring

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `PAGE_AUDIT_MAX_PAGES` | No | No | `50` | Max pages per bulk audit | | | |
| `PAGE_AUDIT_TIMEOUT_MS` | No | No | `60000` | Single page audit timeout (ms) | | | |
| `PAGE_AUDIT_STALE_MS` | No | No | derived | Stale audit threshold (ms) | | | |
| `LINK_CHECK_MAX_PAGES` | No | No | `50` | Max pages per link check | | | |
| `LINK_CHECK_MAX_LINKS` | No | No | `300` | Max links per link check | | | |
| `LINK_CHECK_CONCURRENCY` | No | No | `8` | Parallel link-check fetches | | | |
| `LINK_CHECK_TIMEOUT_MS` | No | No | `8000` | Per-link fetch timeout (ms) | | | |
| `SSL_CHECK_TIMEOUT_MS` | No | No | `8000` | TLS handshake timeout (ms) | | | |

### Miscellaneous

| Variable | Required | Secret | Default | Description | Dev | UAT | Prod |
|----------|----------|--------|---------|-------------|-----|-----|------|
| `OB_HOME_SLUG` | No | No | `ob-homepage` | Publish script homepage slug | | | |
| `OB_PAGE_SLUG` | No | No | `how-it-works` | Publish script page slug | | | |
| `OB_PAGE_TITLE` | No | No | `How It Works` | Publish script page title | | | |
| `OB_SITE_SUBDOMAIN` | No | No | `officebeacon` | Publish script site subdomain | | | |
| `OB_LAYOUT_PATH` | No | No | — | Publish script layout JSON file path | | | |

---

## UAT Environment

UAT is internal testing owned by DevOps. Configuration is split by deployment surface:

| Surface | Template |
|---------|----------|
| Backend (API, worker) | [`uat-be.env.example`](./uat-be.env.example) |
| Frontend (admin, renderer build-time) | [`uat-fe.env.example`](./uat-fe.env.example) |
| Index / pointer | [`uat.env.example`](./uat.env.example) |

**Checklist:** [`deployment-checklist.md`](./deployment-checklist.md#uat)

**UAT URLs:** FE `https://uat-cms.officebeacon.net` · BE `https://uat-cms-api.officebeacon.net`

### Runtime label

| Setting | UAT value | Notes |
|---------|-----------|-------|
| `ENVIRONMENT` | `staging` | **Required.** Boot validation rejects `uat` — use `staging` for UAT |
| `NODE_ENV` | `production` | Standard for deployed Node/Next builds |

### Implementation defaults (pre-populated in template)

These values match runtime behavior when unset (from `.env.example`, `packages/config`, and app config loaders):

> **Excluded:** `GLOBAL_PREFIX` — API versioning is code-managed ([`docs/api-versioning.md`](../api-versioning.md)). Do not populate in UAT or Production deployment templates.

| Variable | Runtime default | Source |
|----------|-----------------|--------|
| `API_PORT` | `3001` | `app.config.ts` / `env.ts` |
| `WORKER_PORT` | `3011` | `app.config.ts` / `env.ts` |
| `RENDERER_PORT` | `3000` | renderer dev config |
| `VITE_APP_PORT` | `5001` | `vite.config.ts` |
| `ACCESS_TOKEN_EXPIRY` | `15m` | `auth.config.ts` |
| `REFRESH_TOKEN_EXPIRY` | `7d` | `auth.config.ts` |
| `RATE_LIMIT_*` | see matrix | `rate-limit.config.ts` |
| `AI_DEFAULT_PROVIDER` | `claude` | `ai.constants.ts` |
| `AI_RATE_PER_MIN` / `AI_MONTHLY_*` | see matrix | worker guardrails |
| Worker crons / processor tuning | see matrix | worker processors |
| `RENDERER_ISR_REVALIDATE` | `60` | `renderer/src/lib/env.ts` |
| `RENDERER_REDIRECT_TTL` | `30` | `renderer/src/middleware.ts` |
| `RENDERER_REDIS_CACHE` | `true` (enabled unless `false`) | `renderer/src/lib/env.ts` |
| `DATABASE_SSL` | `false` | `.env.example` / `env.ts` |
| `EDGE_PROVIDER` | `none` | `platform-config.ts` |
| `OBJECT_STORAGE_PROVIDER` | `s3` | `platform-config.ts` |
| `SMTP_PORT` | `1025` | `mail.config.ts` |
| `AUTH0_ENABLED` | `false` | `auth.config.ts` |
| `SUPER_ADMIN_EMAIL` | `admin@officebeacon.com` | `seed.ts` |

### Recommended deployment values (UAT templates)

These appear in [`uat-be.env.example`](./uat-be.env.example) and [`uat-fe.env.example`](./uat-fe.env.example) — they differ from runtime defaults where noted:

| Variable | Recommended UAT value | Runtime default | Why |
|----------|----------------------|-----------------|-----|
| `ENVIRONMENT` | `staging` | `local` | UAT boot label (not `uat`) |
| `NODE_ENV` | `production` | `development` | Standard for deployed builds |
| `DATABASE_SSL` | `true` | `false` | Managed Postgres in UAT |
| `EDGE_PROVIDER` | `cloudflare` | `none` | Planned Cloudflare edge profile |
| `OBJECT_STORAGE_PROVIDER` | `s3` | `s3` | AWS S3 for UAT media (runtime default: `s3`) |
| `AI_MOCK` | `false` | `false` | Real integrations in UAT (same default; explicit for clarity) |

`SMTP_PORT` is **DevOps-owned** (left blank in the template). Runtime default is `1025` (MailHog); typical SMTP relays use `587` or `465`.

### DevOps-owned (must be supplied — leave blank in templates)

All secrets and deployment-specific URLs. Populate blank values in [`uat-be.env.example`](./uat-be.env.example) and [`uat-fe.env.example`](./uat-fe.env.example). Key groups:

| Group | Variables |
|-------|-----------|
| Database | `DATABASE_URL`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_NAME` |
| Redis | `REDIS_HOST`, `REDIS_PASSWORD` |
| Auth / JWT | `JWT_SECRET`, `PREVIEW_TOKEN_SECRET`, `AUTH0_*` (when enabled), `COOKIE_DOMAIN` |
| Encryption | `ENCRYPTION_KEY` |
| Public URLs | `ALLOWED_ORIGINS`, `APP_PUBLIC_URL`, `VITE_API_URL`, `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`, `RENDERER_*`, `AUDIT_BASE_URL`, `PLATFORM_*` |
| Object storage | `OBJECT_STORAGE_*`, `S3_*`, buckets, public media URL |
| Cloudflare | `CLOUDFLARE_ZONE_ID` (when capabilities enabled) |
| Turnstile | `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY` |
| Email | `SMTP_*`, `SMTP_PORT`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `MAIL_FROM` |
| CRM | `CRM_WEBHOOK_URL`, `CRM_HMAC_SECRET` |
| Cache / ISR | `REVALIDATE_SECRET` |
| Seed | `SUPER_ADMIN_PASSWORD` |

### Differences from Development

| Variable | Development | UAT |
|----------|-------------|-----|
| `ENVIRONMENT` | `local` | `staging` |
| `DATABASE_SSL` | `false` (runtime default) | `true` (recommended deployment value) |
| `DATABASE_URL` | local Docker Postgres | managed Postgres (DevOps) |
| `JWT_SECRET` | dev placeholder | strong secret (DevOps) |
| `AI_MOCK` | often `false` locally; mock-friendly | `false` (real integrations) |
| `CRM_WEBHOOK_URL` | mock CRM endpoint | real UAT CRM endpoint |
| `COOKIE_DOMAIN` | `localhost` | UAT admin domain |
| `ALLOWED_ORIGINS` | localhost ports | UAT admin + renderer origins |
| All public URLs | `localhost:*` | UAT hostnames |
| Object storage | local MinIO (`S3_ENDPOINT` / `OBJECT_STORAGE_PROVIDER=minio`) | AWS S3 (`OBJECT_STORAGE_PROVIDER=s3`; omit `OBJECT_STORAGE_ENDPOINT`) |
| Mail | MailHog (`SMTP_PORT` runtime default `1025`) | real SMTP relay (DevOps sets `SMTP_PORT`, often `587`) |

### Differences from Production

| Area | UAT | Production |
|------|-----|------------|
| `ENVIRONMENT` | `staging` | `production` |
| JWT boot validation | default secret allowed | **rejects** default `JWT_SECRET` |
| Secrets | UAT-specific rotation | separate Production rotation |
| Search indexing | **must never be indexed** — no public sitemap, no production canonical URLs, `noindex, nofollow` via deployment/infra policy (see UAT indexing policy) | Production SEO as configured for the live site |
| CRM / webhooks | UAT endpoints | Production endpoints |
| Rate limits | may match prod or be relaxed | production traffic tuning |

### Deployment notes

- Run `bun run db:migrate` before app rollout.
- Seed once with rotated `SUPER_ADMIN_PASSWORD`; do not commit the password.
- Worker must reach renderer via `RENDERER_INTERNAL_URL` on the private network.
- Admin and renderer URLs are **build-time** for Vite/Next — inject at CI build, not runtime.
- UAT must enforce `noindex, nofollow` and must not generate public sitemaps — this is **deployment/infra policy**, not a dedicated environment variable (see `.cursor/rules/uat-indexing-policy.mdc`).

### Cloudflare notes (UAT)

- **Recommended deployment value:** `EDGE_PROVIDER=cloudflare` (runtime default: `none`).
- `CLOUDFLARE_PURGE_ENABLED` and `CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED` runtime default to `false` (config validation only until network adapters ship).
- `CLOUDFLARE_ZONE_ID` required when either capability flag is `true`.

### Turnstile notes (UAT)

- **Currently supported:** `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (implemented in API `CaptchaService`).
- Optional. When unset, captcha enforcement falls back to honeypot/timing gates.
- Set both keys when testing captcha-enabled forms in UAT.

### AWS S3 notes (UAT / production)

- **Recommended deployment value:** `OBJECT_STORAGE_PROVIDER=s3` with `OBJECT_STORAGE_REGION` set to the actual AWS region where DevOps provisions the bucket (for example `us-east-2`).
- Use provider-neutral `OBJECT_STORAGE_*` variables (preferred over legacy `S3_*`). Runtime code in `platform-config.ts` still reads legacy `S3_*` aliases when present — treat stale secrets as a migration risk, not as harmless omissions in templates.
- **Do not set** `OBJECT_STORAGE_ENDPOINT` for native AWS S3 — the SDK uses default AWS endpoints. **`S3_ENDPOINT` must also be removed from the deployment secret store** (omitting it in an example env file is not enough).
- The AWS region must come from **`OBJECT_STORAGE_REGION`**. Do **not** leave a stale **`S3_REGION=auto`** (or any other legacy `S3_REGION` value) in the secret store for native AWS S3 — `S3_REGION=auto` is appropriate only for the R2 alternative below.
- Public media delivery must use **`OBJECT_STORAGE_PUBLIC_MEDIA_URL`**. Remove or replace any stale **`S3_PUBLIC_URL`** secret; runtime may still honor the legacy alias if it remains deployed.
- `OBJECT_STORAGE_BUCKET` is the DevOps-provisioned S3 bucket name; the application does **not** create the media bucket.
- **Secret-store cleanup (required):** Removing or blanking variables in [`uat-be.env.example`](./uat-be.env.example) / [`production.env.example`](./production.env.example) **does not delete** values already stored in the UAT/production deployment secret store. DevOps must **explicitly remove or replace** these legacy aliases when migrating to native AWS S3:
  - `S3_ENDPOINT`
  - `S3_REGION` (including **`S3_REGION=auto`** — must not remain for native AWS S3)
  - `S3_PUBLIC_URL`
- **Alternative:** `OBJECT_STORAGE_PROVIDER=r2` remains supported for S3-compatible endpoints (requires `OBJECT_STORAGE_ENDPOINT` and `OBJECT_STORAGE_REGION=auto`).

### Worker notes (UAT)

- Shares `DATABASE_URL` and `REDIS_*` with API.
- Cron schedules pre-populated in template; adjust for UAT load if needed.
- `REVALIDATE_SECRET` must match renderer for publish → cache purge flow.
- `CHROME_PATH` required only if Lighthouse page audits run in UAT.

### Renderer notes (UAT)

- `INTERNAL_API_URL` for server-side middleware and ISR fetches.
- `NEXT_PUBLIC_API_URL` baked at build time for client-side calls.
- `RENDERER_ISR_REVALIDATE=60` and `RENDERER_REDIRECT_TTL=30` are safe defaults.
- `AUDIT_BASE_URL` should be the public renderer origin, not the admin SPA.

---

## Deployment Checklist

See the dedicated checklists document: [`docs/infrastructure/deployment-checklist.md`](./deployment-checklist.md)

Covers Development, UAT, Production, and per-service verification (API, Admin, Renderer, Worker, PostgreSQL, Redis, Cloudflare, Turnstile, AWS S3, SMTP, DNS, SSL, Monitoring, Backups, Rollback).

**Quick pre-deploy verification:**

- [ ] All **required** variables are set (`DATABASE_URL`, `ENVIRONMENT`, production `JWT_SECRET`, …)
- [ ] All **secrets** are configured in the target secret store (never committed to git)
- [ ] **Production-only** values differ from development placeholders
- [ ] **Cloudflare**, **AWS S3**, **Redis**, **database**, **renderer**, **API**, and **worker** configs verified

---

## PR Requirements

Every pull request that **introduces**, **removes**, **renames**, or **changes** an environment variable or deployment step MUST:

1. Update this document (`docs/infrastructure/environment-variables.md`)
2. Update [`uat-be.env.example`](./uat-be.env.example) and/or [`uat-fe.env.example`](./uat-fe.env.example) when UAT is affected (keep [`uat.env.example`](./uat.env.example) pointer in sync if needed)
3. Update [`production.env.example`](./production.env.example) when Production is affected
4. Update [`deployment-checklist.md`](./deployment-checklist.md) when deployment or environment changes affect operator checklists
5. Update [`.env.example`](../../.env.example) when the variable affects local development
6. Update relevant architecture docs when behavior spans deployment profiles
7. Leave secret values blank in all documentation tables and templates
8. Label any value that differs from runtime defaults as a **recommended deployment value**
9. Document new defaults, required/optional status, and DevOps ownership

The Cursor rule [`.cursor/rules/environment-documentation.mdc`](../../.cursor/rules/environment-documentation.mdc) enforces this for AI-assisted changes.

---

## DevOps Notes

- **Developers never commit secrets.** Use `.env` locally (gitignored). Document variable names and purpose only.
- **Developers document required variables** and safe local defaults in this file and `.env.example`.
- **DevOps owns actual values** for UAT and Production, including secret rotation, bucket provisioning, DNS, and CDN configuration.
- Boot-time validation lives in `apps/api/src/config/env.config.ts` (required subset) and `packages/config/src/platform-config.ts` (storage/edge contract). Validation errors name variables and relationships — never secret values.

---

## Future Features

Reserve these sections for upcoming infrastructure. **Append new variables here** rather than reorganizing existing documentation.

### Cloudflare

*Reserved — edge capabilities beyond current config-only flags.*

### Turnstile

**Currently supported:** `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (see [Cloudflare](#cloudflare) category and UAT Turnstile notes).

*Reserved — additional Turnstile variables (e.g. per-tenant keys) not yet in the codebase.*

### Image Optimization

*Reserved — CDN/worker image transformation variables.*

### CDN

*Reserved — see [CDN](#cdn) category above.*

### Cache

*Reserved — cache purge, ISR, and edge cache TTL variables beyond `REVALIDATE_SECRET` and `RENDERER_ISR_REVALIDATE`.*

### Workers

*Reserved — Cloudflare Workers or additional BullMQ worker configuration.*

### R2

**Currently supported:** `OBJECT_STORAGE_PROVIDER=r2` and related `OBJECT_STORAGE_*` variables via `loadPlatformConfig`.

*Reserved — additional R2-specific variables beyond the current `OBJECT_STORAGE_*` contract.*

### D1

*Reserved — Cloudflare D1 database variables.*

### Queues

*Reserved — Cloudflare Queues or additional job queue configuration.*

### Cron

*Reserved — additional scheduled job cron expressions beyond current worker crons.*

### Email

*Reserved — additional transactional email provider variables.*

### Monitoring

*Reserved — APM, error tracking, and observability exporter variables.*

### Observability

*Reserved — OpenTelemetry, log shipping, and metrics endpoint configuration.*

---

## Discovery Notes

Variables were discovered by scanning:

- [`.env.example`](../../.env.example)
- `apps/api/src/config/*.ts`, `apps/api/src/database/db.ts`, and module-level `process.env` usage
- `apps/worker/src/**/*.ts`
- `apps/renderer/src/lib/env.ts`, `apps/renderer/src/middleware.ts`
- `apps/admin/vite.config.ts`, `apps/admin/orval.config.ts`
- `packages/config/src/env.ts`, `packages/config/src/platform-config.ts`
- `packages/crypto/src/preview-token.ts`
- `infra/docker-compose.yml`
- `scripts/publish-ob-*.mjs`, `scripts/repair-*.mjs`
- Architecture and module docs under `docs/` and `apps/api/*.md`

**Not included:** Docker-internal variables with no application consumer beyond Compose (`POSTGRES_*`, `MINIO_ROOT_*` are listed under Database / Object Storage for completeness). Shell-only `PATH` exports in README are not environment variables.

**Templates:** [`uat-be.env.example`](./uat-be.env.example) · [`uat-fe.env.example`](./uat-fe.env.example) · [`uat.env.example`](./uat.env.example) (pointer) · [`production.env.example`](./production.env.example)

**Present in code but absent from `.env.example`** (documented here and included in UAT/Production templates): `INTERNAL_API_URL`, `RENDERER_*` tuning vars, worker cron schedules, `TURNSTILE_*`, `PLATFORM_DOMAIN`, `PLATFORM_BASE_DOMAIN`, `PREVIEW_TOKEN_SECRET`, `SUPER_ADMIN_*`, `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_AUDIENCE`, `VITE_APP_PORT`, `VITE_UNSPLASH_ACCESS_KEY`, monitoring/audit processor limits, and publish-script `OB_*` variables.
