# Platform configuration boundary

Issues [#5](https://github.com/Office-Beacon-LLC/cms/issues/5)–[#9](https://github.com/Office-Beacon-LLC/cms/issues/9)
establish the provider-neutral configuration foundation, adopt it in the API and
worker, document deployment matrices, and prove cross-runtime compatibility.
Operator matrices, examples, migration notes, and PR 1 out-of-scope boundaries:
[platform-deployment.md](./platform-deployment.md).

## What exists today

| Layer | Location | Role |
|-------|----------|------|
| Loader | `packages/config/src/platform-config.ts` | Pure `loadPlatformConfig(environment)` |
| Contracts | `packages/config/src/provider-contracts.ts` | Domain interfaces for future adapters |
| API | `apps/api/src/modules/media/storage.service.ts` | Normalized targets (#6) |
| Worker | `apps/worker/src/platform-storage.ts` | Same loader for image/backup I/O (#7) |
| Quality gate | `packages/config/test/cross-runtime-compatibility.test.ts` | API ≡ worker ≡ loader (#9) |

Issue #5 does **not** instantiate vendor clients. Issues #6–#7 do **not** add
Cloudflare or R2 network adapters; they route storage through the normalized
config while preserving legacy S3/MinIO behavior when only `S3_*` is set.
Issue #9 adds hermetic cross-runtime tests and a CI quality-gate step; it adds
no vendor SDKs or network adapters.

## Decisions

- `loadPlatformConfig(environment)` is the only normalization seam. It is pure,
  reads no process globals, performs no I/O, and returns a deeply frozen value.
- One edge provider is selected with `EDGE_PROVIDER`: `none` (the default),
  `cloudfront`, or `cloudflare`.
- Cloudflare purge and Custom Hostnames are independent, default-off
  capabilities. Enabling either requires `EDGE_PROVIDER=cloudflare` and
  `CLOUDFLARE_ZONE_ID`.
- Object storage is selected with `OBJECT_STORAGE_PROVIDER`: `s3` (the
  backward-compatible default), `minio`, or `r2`. R2 selection does not enable
  Cloudflare edge capabilities.
- Provider-neutral `OBJECT_STORAGE_*` variables take precedence, variable by
  variable, over existing `S3_*` aliases. With no new variables, the normalized
  endpoint, region, credentials, bucket, and public URL retain current
  S3/MinIO defaults.
- `OBJECT_STORAGE_MODE=shared` is the default. It maps public media, private
  form attachments, and private backups to one physical bucket while retaining
  distinct logical targets and visibility. `isolated` requires one bucket for
  every target.
- Optional normalized values use `null`, not a mixture of `null` and
  `undefined`.
- Validation errors identify variable names and relationships but never echo
  environment values.
- Provider interfaces describe storage, purge, and hostname domain operations.
  Vendor SDK request and response types belong only in future adapters.

## Variable contract

Edge and capability variables:

- `EDGE_PROVIDER` — `none` | `cloudfront` | `cloudflare` (default `none`)
- `CLOUDFLARE_PURGE_ENABLED` — `true` | `false` (default `false`)
- `CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED` — `true` | `false` (default `false`)
- `CLOUDFLARE_ZONE_ID` — required when either Cloudflare capability is enabled

Provider-neutral storage variables:

- `OBJECT_STORAGE_PROVIDER`
- `OBJECT_STORAGE_MODE`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_REGION`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_PUBLIC_MEDIA_URL`
- `OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET`
- `OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET`
- `OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET`

The compatible aliases are `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY`, `S3_BUCKET`, and `S3_PUBLIC_URL`.

Full matrices, deployment examples, precedence details, and out-of-scope items:
[platform-deployment.md](./platform-deployment.md).

## Deferred behavior

Origin applications remain the authority for security headers. Full HTML edge
caching is deferred. Future publish-time purge must be fail-soft, Sharp remains
the initial image transformer, Terraform owns edge resources, and standard CI
must remain credential-free.
