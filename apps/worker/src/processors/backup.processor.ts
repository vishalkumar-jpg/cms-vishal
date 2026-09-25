import { spawn } from "node:child_process";
import { createGunzip, createGzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Job, Queue } from "bullmq";
import { db } from "../db/db";
import { backups, type BackupRow } from "../db/schema";
import { generateKSUIDWithPrefixSync } from "../db/ksuid";
import { BACKUP_JOBS } from "../queue-names";
import {
  bucketForTarget,
  loadWorkerObjectStorage,
  objectStorageClientOptions,
} from "../platform-storage";

/**
 * Platform database BACKUP / RESTORE processor (gap E26).
 *
 * Runs on the `backup` queue for three job kinds (BullMQ job NAME selects):
 *   - "run"       — pg_dump → gzip → upload to storage → mark the row completed.
 *   - "restore"   — download a completed dump → psql restore. DESTRUCTIVE.
 *   - "scheduled" — repeatable/cron: insert a `kind:scheduled` pending row and
 *                   enqueue a "run" for it (the daily backup).
 *
 * IMPORTANT — pg_dump / psql binary requirement:
 *   The dump/restore shell out to the Postgres client binaries (`pg_dump`,
 *   `psql`) via `node:child_process` spawn with `DATABASE_URL`. These binaries
 *   must exist at runtime (postgresql-client). If a binary is MISSING the spawn
 *   is GUARDED: the row is marked `failed` with a clear message and the worker
 *   does NOT crash. Install with e.g. `apk add postgresql-client` (alpine) or
 *   `apt-get install postgresql-client`. See apps/api/BACKUPS.md.
 *
 *   The S3 client (`@aws-sdk/client-s3`) is loaded via a guarded dynamic import
 *   (mirrors image-process.processor.ts) so the worker type-checks/runs without
 *   it; when absent a `run` job marks the row `failed` rather than crashing.
 */

/** Retention: keep the most recent N completed backups; prune older ones. */
const RETENTION_KEEP = Number(process.env.BACKUP_RETENTION_KEEP ?? "7");
/** Retention: also prune completed backups older than N days. */
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? "30");

interface BackupJobData {
  backupId?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface S3Like {
  put(key: string, filePath: string, contentType: string): Promise<void>;
  get(key: string, destPath: string): Promise<void>;
  delete(key: string): Promise<void>;
  buildKey(filename: string): string;
}

async function loadS3(): Promise<S3Like | null> {
  // Resolve normalized config before the optional SDK import so invalid platform
  // configuration fails with PlatformConfigError (actionable, secret-safe)
  // instead of being mistaken for a missing dependency.
  const objectStorage = loadWorkerObjectStorage(process.env);

  try {
    const aws = await import(/* @vite-ignore */ "@aws-sdk/client-s3" as string);
    const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } =
      aws as any;
    const bucket = bucketForTarget(objectStorage, "privateBackups");
    const client = new S3Client(objectStorageClientOptions(objectStorage));
    return {
      buildKey: (filename: string) => `backups/${filename}`,
      async put(key: string, filePath: string, contentType: string): Promise<void> {
        // Ensure the bucket exists (fresh env / first run) — HeadBucket then
        // CreateBucket on 404/NoSuchBucket; ignore already-owned races.
        try {
          await client.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch {
          try {
            await client.send(new CreateBucketCommand({ Bucket: bucket }));
          } catch {
            /* already exists / owned by us — proceed */
          }
        }
        // Read into a Buffer so the SDK sets a concrete Content-Length and skips
        // aws-chunked streaming signing (MinIO rejects a stream Body with
        // "must provide Content-Length"). Dumps are gzipped + typically small;
        // for very large DBs switch to @aws-sdk/lib-storage multipart Upload.
        const body = await readFile(filePath);
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            ContentLength: body.length,
          }),
        );
      },
      async get(key: string, destPath: string): Promise<void> {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        await pipeline(out.Body as NodeJS.ReadableStream, createWriteStream(destPath));
      },
      async delete(key: string): Promise<void> {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      },
    };
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Spawn a command, rejecting on a non-zero exit or a missing binary (ENOENT). */
function run(
  cmd: string,
  args: string[],
  opts: { onStdout?: (chunk: Buffer) => void } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: process.env });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    if (opts.onStdout) child.stdout.on("data", opts.onStdout);
    child.on("error", (err: NodeJS.ErrnoException) => {
      // ENOENT → the binary isn't installed in this environment.
      reject(
        err.code === "ENOENT"
          ? new Error(`${cmd} binary not found — install postgresql-client to enable backups`)
          : err,
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}${stderr ? `: ${stderr.slice(0, 1500)}` : ""}`));
    });
  });
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — required for pg_dump/restore");
  }
  return url;
}

/** Public entry — routes by job name. */
export async function processBackup(job: Job<BackupJobData>, backupQueue: Queue): Promise<unknown> {
  switch (job.name) {
    case BACKUP_JOBS.SCHEDULED:
      return enqueueScheduled(backupQueue);
    case BACKUP_JOBS.RESTORE:
      return runRestore(job.data.backupId);
    case BACKUP_JOBS.RUN:
    default:
      return runBackup(job.data.backupId);
  }
}

/** Insert a `kind:scheduled` pending row and enqueue a run for it (daily cron). */
async function enqueueScheduled(backupQueue: Queue): Promise<{ enqueued: string }> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const id = generateKSUIDWithPrefixSync("bak");
  await db.insert(backups).values({
    id,
    filename: `ob-cms-${ts}.sql.gz`,
    status: "pending",
    kind: "scheduled",
  });
  await backupQueue.add(
    BACKUP_JOBS.RUN,
    { backupId: id },
    { jobId: `backup-run:${id}`, attempts: 1 },
  );
  console.log(`[worker:backup] scheduled backup enqueued ${id}`);
  return { enqueued: id };
}

/** pg_dump → gzip to a temp file → upload → mark completed → prune old. */
async function runBackup(backupId?: string): Promise<{ ok: boolean }> {
  if (!backupId) return { ok: false };
  const [row] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
  if (!row || row.deletedAt) return { ok: false };

  await db
    .update(backups)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(backups.id, backupId));

  const dir = await mkdtemp(join(tmpdir(), "ob-cms-backup-"));
  const dumpPath = join(dir, "dump.sql");
  const gzPath = join(dir, row.filename);

  try {
    const url = requireDatabaseUrl();
    // 1. pg_dump the whole database to a plain-SQL temp file (guarded spawn).
    await run(process.env.PG_DUMP_BIN ?? "pg_dump", [
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "-f",
      dumpPath,
      url,
    ]);
    // 2. gzip the dump on disk (node:zlib — no extra dependency).
    await pipeline(createReadStream(dumpPath), createGzip(), createWriteStream(gzPath));
    const { size } = await stat(gzPath);

    // 3. upload to object storage.
    const s3 = await loadS3();
    if (!s3) {
      throw new Error(
        "@aws-sdk/client-s3 not installed — run 'cd apps/worker && bun add @aws-sdk/client-s3'",
      );
    }
    const key = s3.buildKey(row.filename);
    await s3.put(key, gzPath, "application/gzip");

    await db
      .update(backups)
      .set({ status: "completed", sizeBytes: size, storageKey: key, completedAt: new Date(), error: null })
      .where(eq(backups.id, backupId));
    console.log(`[worker:backup] completed ${backupId} (${size} bytes → ${key})`);

    await pruneOldBackups(s3);
    return { ok: true };
  } catch (err) {
    const message = (err as Error).message.slice(0, 1900);
    // GUARDED: a missing pg_dump binary (or any failure) marks the row failed —
    // it must NOT crash the worker. The admin sees the reason + can re-trigger.
    await db
      .update(backups)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(backups.id, backupId));
    console.error(`[worker:backup] failed ${backupId}: ${message}`);
    return { ok: false };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * DESTRUCTIVE restore: download the dump → gunzip → psql replay. Overwrites the
 * current database. The dump was taken with --clean --if-exists so it drops then
 * recreates objects. Logged loudly. The API only enqueues this after an explicit
 * confirm flag.
 */
async function runRestore(backupId?: string): Promise<{ ok: boolean }> {
  if (!backupId) return { ok: false };
  const [row] = await db.select().from(backups).where(eq(backups.id, backupId)).limit(1);
  if (!row || !row.storageKey || row.status !== "completed") {
    console.error(`[worker:backup] restore aborted — backup ${backupId} not restorable`);
    return { ok: false };
  }

  console.warn(
    `[worker:backup] ⚠️  RESTORE STARTING for ${backupId} (${row.filename}) — this OVERWRITES the live database`,
  );
  const dir = await mkdtemp(join(tmpdir(), "ob-cms-restore-"));
  const gzPath = join(dir, row.filename);
  const sqlPath = join(dir, "restore.sql");

  try {
    const url = requireDatabaseUrl();
    const s3 = await loadS3();
    if (!s3) throw new Error("@aws-sdk/client-s3 not installed — cannot download dump for restore");
    await s3.get(row.storageKey, gzPath);
    await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(sqlPath));
    // psql replays the dump (guarded spawn). -v ON_ERROR_STOP=1 fails loudly.
    await run(process.env.PSQL_BIN ?? "psql", ["-v", "ON_ERROR_STOP=1", "-f", sqlPath, url]);
    console.warn(`[worker:backup] ✅ RESTORE COMPLETE for ${backupId}`);
    return { ok: true };
  } catch (err) {
    const message = (err as Error).message.slice(0, 1900);
    console.error(`[worker:backup] ❌ RESTORE FAILED for ${backupId}: ${message}`);
    return { ok: false };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Retention: keep the most recent RETENTION_KEEP completed backups AND any
 * completed within RETENTION_DAYS; soft-delete + remove the dump for the rest.
 */
async function pruneOldBackups(s3: S3Like): Promise<void> {
  const completed = await db
    .select()
    .from(backups)
    .where(and(eq(backups.status, "completed"), isNull(backups.deletedAt)))
    .orderBy(desc(backups.createdAt));

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const toPrune: BackupRow[] = completed.filter(
    (b, idx) => idx >= RETENTION_KEEP && b.createdAt < cutoff,
  );

  for (const b of toPrune) {
    if (b.storageKey) await s3.delete(b.storageKey).catch(() => undefined);
    await db.update(backups).set({ deletedAt: new Date() }).where(eq(backups.id, b.id));
    console.log(`[worker:backup] pruned old backup ${b.id} (${b.filename})`);
  }
}
