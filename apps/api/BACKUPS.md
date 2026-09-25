# Database Backup / Restore (gap E26)

Platform-level (super-admin, cross-tenant) **pg_dump** backups to object storage,
with a backups list, on-demand + scheduled (daily cron) backups, restore, and
retention. Surfaced in the platform-admin console at **`/platform/backups`**.

A backup is a dump of the **whole cluster** — it is NOT site-scoped. Every
surface is guarded by the existing `@PlatformAdmin()` decorator /
`PlatformAdminGuard` (caller must have `isPlatformAdmin`); non-admins get `403`.

---

## Schema — `ob_cms.backups` (prefix `bak`)

Migration: `src/database/migrations/0018_backups.sql`. Drizzle table:
`src/database/schema/backups.schema.ts` (worker mirror in
`apps/worker/src/db/schema.ts`).

| column         | type         | notes                                             |
| -------------- | ------------ | ------------------------------------------------- |
| `id`           | varchar(50)  | KSUID, prefix `bak`                                |
| `filename`     | varchar(300) | e.g. `ob-cms-2026-06-29T02-00-00-000Z.sql.gz`     |
| `size_bytes`   | bigint       | compressed dump size (filled when completed)      |
| `status`       | varchar(20)  | `pending` \| `running` \| `completed` \| `failed` |
| `kind`         | varchar(20)  | `manual` \| `scheduled`                           |
| `storage_key`  | varchar(500) | object-storage key for the dump (null until done) |
| `error`        | varchar(2000)| failure detail when `status='failed'`             |
| `started_at`   | timestamptz  | set when the worker picks it up                   |
| `completed_at` | timestamptz  | set on completion/failure                         |
| + `baseColumns`| —            | `created_at/updated_at/deleted_at/created_by/...` |

No `site_id` / FK — backups are cluster-wide. Index: `bak_status_createdat_idx`.
The bytes live in object storage; this table is the index + status ledger.
Deletes are soft (`deleted_at`).

---

## API — `modules/backups` (registered in `app.module.ts`)

All routes `@PlatformAdmin()`, mounted at `/api/v1/platform/backups`.

| method + path                         | action                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| `GET    /platform/backups`            | list all backups (newest first)                              |
| `POST   /platform/backups`            | trigger a **manual** backup → inserts a `pending` row + enqueues a worker `run` job → returns the pending row (`201`) |
| `GET    /platform/backups/:id/download` | presigned/public URL for a completed dump                  |
| `POST   /platform/backups/:id/restore`  | **DESTRUCTIVE** — enqueue a restore job. Requires `{ "confirm": true }` in the body (`RestoreBackupDto` `@Equals(true)`); a missing/false flag → `400` before any job is enqueued. Loudly audited. |
| `DELETE /platform/backups/:id`          | delete the dump object (best-effort) + soft-delete the row |

Non-platform-admin → `403` on every route (guard runs before the handler).
Every mutation writes an `audit_log` row (`platform.backup.created` /
`.restore_requested` / `.deleted`).

---

## Worker — backup processor (`apps/worker/src/processors/backup.processor.ts`)

Runs on the `backup` BullMQ queue (registered in `apps/worker/src/worker.ts`,
`concurrency: 1`). The BullMQ job **name** selects behaviour:

- **`run`** — `pg_dump` (plain SQL, `--clean --if-exists --no-owner
  --no-privileges`) to a temp file → gzip on disk (`node:zlib`, no extra dep) →
  upload to storage → mark the row `completed` with `size_bytes` + `storage_key`
  → prune old backups (retention).
- **`restore`** — download the dump → gunzip → `psql -v ON_ERROR_STOP=1 -f` to
  replay it. **Overwrites the live database.** Logged loudly. Only enqueued by
  the API after the explicit `confirm` flag.
- **`scheduled`** — the daily repeatable job: inserts a `kind:scheduled`
  `pending` row and enqueues a `run` for it.

Only the `backups` row id travels through Redis; the worker reads `DATABASE_URL`
from its own env. Postgres is the source of truth.

### ⚠️ pg_dump / psql binary requirement

The dump/restore shell out to the Postgres **client binaries** (`pg_dump`,
`psql`) via `node:child_process` spawn. **These must exist at runtime.** The
spawn is **guarded**: a missing binary (`ENOENT`) — or any other failure — marks
the row `failed` with a clear message (`"pg_dump binary not found — install
postgresql-client to enable backups"`) and **does NOT crash the worker**. So in
an environment without the binaries, triggering a backup produces a `failed`
row (acceptable), and the worker keeps serving other queues.

Install at runtime, e.g.:

```sh
# Debian/Ubuntu
apt-get install -y postgresql-client
# Alpine
apk add postgresql-client
```

The S3 client (`@aws-sdk/client-s3`) is loaded via a **guarded dynamic import**
(mirrors `image-process.processor.ts`) so the worker type-checks/runs without it;
when absent a `run` job marks the row `failed` rather than crashing. Install it
for real uploads: `cd apps/worker && bun add @aws-sdk/client-s3`. Dumps are
stored under the `backups/` key prefix in `S3_BUCKET`.

---

## Retention

Applied after every successful `run` (`pruneOldBackups`):

- keep the most recent **`BACKUP_RETENTION_KEEP`** completed backups (default
  `7`), **and**
- keep any completed within **`BACKUP_RETENTION_DAYS`** days (default `30`).

Anything past **both** thresholds is soft-deleted and its dump object removed.

---

## Scheduled cron wiring

**BullMQ repeatable/cron IS available** (bullmq 5.x). `apps/worker/src/worker.ts`
registers a single repeatable job on the `backup` queue at boot:

```ts
backupQueue.add(BACKUP_JOBS.SCHEDULED, {}, {
  repeat: { pattern: process.env.BACKUP_CRON ?? "0 2 * * *" }, // daily 02:00
  jobId: "backup-scheduled",
});
```

It is idempotent by `jobId`, so re-registering on every worker boot is a no-op.
Override the cadence with `BACKUP_CRON` (standard cron pattern). When it fires,
the processor inserts a `kind:scheduled` row and enqueues a `run`.

---

## Env vars

| var                     | default       | purpose                                  |
| ----------------------- | ------------- | ---------------------------------------- |
| `DATABASE_URL`          | —             | required for pg_dump/psql (port `:5433`) |
| `BACKUP_CRON`           | `0 2 * * *`   | scheduled-backup cron pattern            |
| `BACKUP_RETENTION_KEEP` | `7`           | keep N most recent completed backups     |
| `BACKUP_RETENTION_DAYS` | `30`          | also keep anything newer than N days     |
| `S3_BUCKET` / `S3_*`    | media bucket  | object storage for the dump files        |

---

## Staging-environment notes

- Backups are **cluster-wide** — restoring on staging overwrites the staging DB.
  Never point a staging worker at a production `DATABASE_URL`.
- Restore is **irreversible** and overwrites all current data. The admin UI
  requires typing `RESTORE` and the API requires `{ confirm: true }`; the worker
  logs the start/finish loudly and the request is audited.
- `pg_dump`/`psql` versions should be **≥** the server's major version. Install
  `postgresql-client` in the worker image; without it backups simply land as
  `failed` rows (the worker stays healthy).
- The dump is plain SQL with `--clean --if-exists`, so a restore drops + recreates
  objects in the `ob_cms` schema. Run restores during a maintenance window.
- For large databases, raise the worker container's temp-disk + the job timeout;
  the dump is streamed to disk and uploaded as a stream (never held in memory).
