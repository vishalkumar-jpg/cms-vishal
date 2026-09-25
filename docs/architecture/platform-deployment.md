# Platform deployment matrices and compatibility

Operator guide for Cloudflare platform **PR 1** after Issues
[#5](https://github.com/Office-Beacon-LLC/cms/issues/5),
[#6](https://github.com/Office-Beacon-LLC/cms/issues/6), and
[#7](https://github.com/Office-Beacon-LLC/cms/issues/7).

Architecture decisions and the variable contract summary:
[platform-configuration.md](./platform-configuration.md).

Parsing source of truth: `packages/config/src/platform-config.ts`
(`loadPlatformConfig`).

| Issue | Deliverable | Runtime effect |
|-------|-------------|----------------|
| #5 | Pure loader + provider contracts | No network I/O |
| #6 | API `StorageService` uses normalized targets | Media / forms / backups |
| #7 | Worker `platform-storage` uses the same loader | Image process / backups |
| #8 | This documentation | None |

---

## Compatibility guarantees

- Existing **AWS S3** and **MinIO** deployments that only set legacy `S3_*`
  keep the same normalized endpoint, region, credentials, bucket, and public URL
  defaults.
- **Cloudflare is optional.** Default `EDGE_PROVIDER` is `none`. Capability flags
  default to `false`. PR 1 performs **no** Cloudflare network calls.
- **No media or database migration.** Persisted media URLs and rows are not
  rewritten by Issues #5–#7.
- Default **`OBJECT_STORAGE_MODE=shared`** keeps one physical bucket (legacy
  single-bucket behavior) while exposing three logical targets.
- Validation errors name variables and relationships only — **never secrets**.
- Standard CI stays **credential-free**; config tests use fixtures only.

---

## Edge provider matrix

Exactly one edge provider. CloudFront and Cloudflare are **mutually exclusive**
for a hostname.

| `EDGE_PROVIDER` | Meaning | PR 1 runtime |
|-----------------|---------|--------------|
| `none` (default) | No CDN provider selected | Unchanged origin behavior |
| `cloudfront` | Explicit CloudFront selection | Config only — no new CloudFront client |
| `cloudflare` | Explicit Cloudflare selection | Config only — no Cloudflare API calls |

### Cloudflare capabilities (independent, default off)

| Variable | Default | Required when `true` |
|----------|---------|----------------------|
| `CLOUDFLARE_PURGE_ENABLED` | `false` | `EDGE_PROVIDER=cloudflare` + `CLOUDFLARE_ZONE_ID` |
| `CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED` | `false` | `EDGE_PROVIDER=cloudflare` + `CLOUDFLARE_ZONE_ID` |

Setting these flags only **validates configuration**. PR 1 does not purge cache,
provision Custom Hostnames, or touch DNS/TLS.

Turnstile remains separate (`TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`) and is
not controlled by `EDGE_PROVIDER`.

---

## Object storage provider matrix

| `OBJECT_STORAGE_PROVIDER` | Typical use | Notes |
|---------------------------|-------------|--------|
| `s3` (default) | AWS S3 | Endpoint optional (virtual-hosted when omitted) |
| `minio` | Local / self-hosted | Endpoint **required** |
| `r2` | Cloudflare R2 (S3-compatible API) | Endpoint **required**; credentials **required** (no MinIO defaults). Public media URL is **not** derived from the R2 S3 API endpoint |

Selecting `r2` does **not** enable Cloudflare edge capabilities. PR 1 accepts
R2-shaped env for safe preparation; it does **not** add an R2 network adapter or
migrate existing objects.

---

## Storage modes and logical targets

| Target | Visibility | API (#6) | Worker (#7) |
|--------|------------|----------|-------------|
| `publicMedia` | public | Media library | Image processing |
| `privateFormAttachments` | private | Public form uploads | — |
| `privateBackups` | private | Backup download/delete | Backup dump I/O |

### `OBJECT_STORAGE_MODE=shared` (default)

- One bucket: `OBJECT_STORAGE_BUCKET` or `S3_BUCKET` (default `ob-cms-media`).
- Private targets share that bucket; config still sets their `publicUrl` to
  `null`.
- API form URLs in shared mode resolve via the public-media base (legacy
  behavior). Backup downloads use a **presigned GET**.

### `OBJECT_STORAGE_MODE=isolated`

Requires:

- `OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET`
- `OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET`
- `OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET`

Rejects `OBJECT_STORAGE_BUCKET`. Private targets must not reuse the public-media
CDN/base; the API uses `resolveObjectUrl` / `presignDownload` for private reads.

---

## Environment variable reference

### Edge and capabilities

| Variable | Values | Default |
|----------|--------|---------|
| `EDGE_PROVIDER` | `none` \| `cloudfront` \| `cloudflare` | `none` |
| `CLOUDFLARE_PURGE_ENABLED` | `true` \| `false` | `false` |
| `CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED` | `true` \| `false` | `false` |
| `CLOUDFLARE_ZONE_ID` | zone id | unset |

### Provider-neutral object storage

| Variable | Role |
|----------|------|
| `OBJECT_STORAGE_PROVIDER` | `s3` \| `minio` \| `r2` (default `s3`) |
| `OBJECT_STORAGE_MODE` | `shared` \| `isolated` (default `shared`) |
| `OBJECT_STORAGE_ENDPOINT` | S3-compatible endpoint |
| `OBJECT_STORAGE_REGION` | Region (`auto` default for `r2` when unset) |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | Access key |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | Secret key |
| `OBJECT_STORAGE_BUCKET` | Shared-mode bucket |
| `OBJECT_STORAGE_PUBLIC_MEDIA_URL` | Public media base URL |
| `OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET` | Isolated public media bucket |
| `OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET` | Isolated form attachments bucket |
| `OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET` | Isolated backups bucket |

### Legacy `S3_*` aliases

| Legacy | Neutral equivalent |
|--------|--------------------|
| `S3_ENDPOINT` | `OBJECT_STORAGE_ENDPOINT` |
| `S3_REGION` | `OBJECT_STORAGE_REGION` |
| `S3_ACCESS_KEY` | `OBJECT_STORAGE_ACCESS_KEY_ID` |
| `S3_SECRET_KEY` | `OBJECT_STORAGE_SECRET_ACCESS_KEY` |
| `S3_BUCKET` | `OBJECT_STORAGE_BUCKET` |
| `S3_PUBLIC_URL` | `OBJECT_STORAGE_PUBLIC_MEDIA_URL` |

### Precedence and fallback

1. Non-blank **provider-neutral** value wins for that setting.
2. Else non-blank **legacy `S3_*`** alias.
3. Else built-in defaults (`s3` / `shared` / `us-east-1` or R2 `auto` /
   `ob-cms-media` / `minioadmin` credentials — except **`r2` never** receives
   MinIO-style credential defaults).
4. Blank / whitespace-only values count as unset.
5. Public media URL when unset: explicit URL → else for non-`r2`,
   `${endpoint}/${bucket}` when endpoint set → else
   `https://${bucket}.s3.amazonaws.com`. For `r2`, `publicUrl` stays `null`
   until `OBJECT_STORAGE_PUBLIC_MEDIA_URL` or `S3_PUBLIC_URL` is set.

---

## Runtime consumers

- **API** — `apps/api/src/modules/media/storage.service.ts` via
  `loadPlatformConfig`.
- **Worker** — `apps/worker/src/platform-storage.ts` via the same loader
  (`loadWorkerObjectStorage`); image processing uses `publicMedia`, backups use
  `privateBackups`.

Both runtimes share precedence rules; neither re-parses `S3_*` independently.

---

## Deployment examples

Placeholders only — never commit real secrets.

### 1. No edge + MinIO (local default)

```bash
# EDGE_PROVIDER omitted → none
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=ob-cms-media
```

### 2. No edge + AWS S3

```bash
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIA_EXAMPLE_KEY_ID
S3_SECRET_KEY=EXAMPLE_SECRET_ACCESS_KEY
S3_BUCKET=ob-cms-media-prod
S3_PUBLIC_URL=https://cdn.example.com/media
```

### 3. CloudFront + S3 (selection only)

```bash
EDGE_PROVIDER=cloudfront
OBJECT_STORAGE_PROVIDER=s3
OBJECT_STORAGE_REGION=us-east-1
OBJECT_STORAGE_ACCESS_KEY_ID=AKIA_EXAMPLE_KEY_ID
OBJECT_STORAGE_SECRET_ACCESS_KEY=EXAMPLE_SECRET_ACCESS_KEY
OBJECT_STORAGE_BUCKET=ob-cms-media-prod
OBJECT_STORAGE_PUBLIC_MEDIA_URL=https://d111111abcdef8.cloudfront.net
```

### 4. Cloudflare edge selected, capabilities off

```bash
EDGE_PROVIDER=cloudflare
S3_BUCKET=ob-cms-media-prod
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIA_EXAMPLE_KEY_ID
S3_SECRET_KEY=EXAMPLE_SECRET_ACCESS_KEY
```

### 5. Cloudflare purge flag armed (still no network call in PR 1)

```bash
EDGE_PROVIDER=cloudflare
CLOUDFLARE_PURGE_ENABLED=true
CLOUDFLARE_ZONE_ID=example_zone_id
```

### 6. R2-compatible configuration (no live R2 adapter in PR 1)

```bash
EDGE_PROVIDER=none
OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_ACCESS_KEY_ID=R2_ACCESS_KEY_ID
OBJECT_STORAGE_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY
OBJECT_STORAGE_BUCKET=ob-cms-media
OBJECT_STORAGE_PUBLIC_MEDIA_URL=https://media.example.com
```

### 7. Isolated buckets

```bash
OBJECT_STORAGE_MODE=isolated
OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_ACCESS_KEY_ID=minioadmin
OBJECT_STORAGE_SECRET_ACCESS_KEY=minioadmin
OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET=ob-cms-media
OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET=ob-cms-forms
OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET=ob-cms-backups
OBJECT_STORAGE_PUBLIC_MEDIA_URL=http://localhost:9000/ob-cms-media
```

---

## Operator guidance

1. Upgrade with **zero new variables**; confirm media upload and backups still
   work.
2. When changing storage, prefer `OBJECT_STORAGE_*` (neutral wins per variable).
3. Set `EDGE_PROVIDER` explicitly before enabling any Cloudflare capability.
4. Do **not** enable purge / Custom Hostnames until a later adapter PR — flags
   only validate today.
5. Stay on **`shared`** until separate buckets and policies are ready.
6. **Rollback:** remove new vars or set flags back to defaults. No DB rollback
   for PR 1 config.
7. R2-shaped env may be validated by the loader; production R2 I/O waits on a
   later PR.

---

## Migration notes

| Step | Action | Data impact |
|------|--------|-------------|
| A | Deploy #5–#7 | None |
| B | Optionally rename env to `OBJECT_STORAGE_*` | None |
| C | Optionally set `EDGE_PROVIDER` | None (config only) |
| D | Later: `OBJECT_STORAGE_MODE=isolated` | Ops bucket setup; **no automatic URL rewrite** |
| E | Later: purge / Custom Hostnames / R2 adapters | Separate PRs |

---

## Explicit PR 1 out-of-scope items

Not implemented by Issues #5–#9 (PR 1 foundation):

- Cloudflare API clients / SDKs
- Cache Rules, WAF custom rules, or CDN cache-policy changes
- Network **cache purging**
- **Custom Hostnames** / DNS / TLS automation
- **R2** network operations or media byte migration
- Cloudflare **Workers**, Pages, or OpenNext
- Full **HTML edge caching**
- CloudFront removal or Terraform rewrite
- Live Cloudflare resource creation in CI
- Production secret provisioning

Deferred architecture (Spec #4): origin apps own security headers; future
publish-time edge purge is fail-soft; Sharp remains the initial image
transformer; Terraform owns edge resources; CI stays credential-free.

---

## Related links

- [platform-configuration.md](./platform-configuration.md) — decisions and
  variable contract
- `packages/config/src/platform-config.ts` — loader implementation
- `packages/config/src/provider-contracts.ts` — future adapter contracts
- `apps/api/src/modules/media/storage.service.ts` — API consumer (#6)
- `apps/worker/src/platform-storage.ts` — worker consumer (#7)
- `packages/config/test/cross-runtime-compatibility.test.ts` — API/worker
  equivalence quality gate (#9)
