import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { db } from "../db/db";
import { media, type MediaVariant } from "../db/schema";
import {
  bucketForTarget,
  loadWorkerObjectStorage,
  objectStorageClientOptions,
  resolvePublicObjectUrl,
} from "../platform-storage";

/**
 * Image-processing processor (gap D23). Runs on the `media-process` queue for
 * two job kinds:
 *   - "process" — derive intrinsic width/height + a set of responsive widths and
 *     a next-gen (webp/avif) variant for a freshly-confirmed upload.
 *   - "crop"    — apply a server-side crop (pixels) then re-derive variants.
 *
 * Postgres `media` is the source of truth; only ids/keys travel through Redis.
 *
 * IMPORTANT — sharp requirement:
 *   The actual pixel work needs `sharp`, which is NOT currently a worker
 *   dependency (it ships a native binary that cannot be compiled in the build
 *   sandbox). `sharp` is loaded via a guarded dynamic import: when it is absent
 *   the processor degrades gracefully — it marks the row `ready` and leaves
 *   `variants` empty rather than crashing. Install it for runtime with:
 *
 *       cd apps/worker && bun add sharp
 *
 *   Likewise the S3 client (`@aws-sdk/client-s3`) is loaded dynamically so the
 *   worker type-checks/runs without it; install it alongside sharp to upload the
 *   derivatives. Until both are present, the API + admin metadata/folder/usage
 *   features are fully functional and the row is still marked `ready`.
 */

/** Widths we emit derivatives for (skipping any wider than the source). */
const TARGET_WIDTHS = [320, 640, 1024, 1920] as const;
/** Next-gen format(s) we emit in addition to the source's. */
const NEXTGEN_FORMATS = ["webp"] as const;

export interface ImageProcessJobData {
  siteId: string;
  mediaId: string;
  storageKey: string;
  crop?: { x: number; y: number; w: number; h: number };
}

// --- guarded optional deps ---------------------------------------------------
// These modules are not installed in the build sandbox; the dynamic import keeps
// the worker compiling + running. When installed at runtime they're used for
// real. Typed loosely on purpose (no @types available when absent).

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadSharp(): Promise<any | null> {
  try {
    const mod = await import(/* @vite-ignore */ "sharp" as string);
    return (mod as { default?: unknown }).default ?? mod;
  } catch {
    return null;
  }
}

interface S3Like {
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  publicUrl(key: string): string;
}

async function loadS3(): Promise<S3Like | null> {
  // Resolve normalized config before the optional SDK import so invalid platform
  // configuration fails with PlatformConfigError (actionable, secret-safe)
  // instead of being mistaken for a missing dependency.
  const objectStorage = loadWorkerObjectStorage(process.env);

  try {
    const aws = await import(/* @vite-ignore */ "@aws-sdk/client-s3" as string);
    const { S3Client, GetObjectCommand, PutObjectCommand } = aws as any;
    const bucket = bucketForTarget(objectStorage, "publicMedia");
    const client = new S3Client(objectStorageClientOptions(objectStorage));
    return {
      async get(key: string): Promise<Buffer> {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = await out.Body.transformToByteArray();
        return Buffer.from(bytes);
      },
      async put(key: string, body: Buffer, contentType: string): Promise<void> {
        await client.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
        );
      },
      publicUrl: (key: string) => resolvePublicObjectUrl(objectStorage, key, "publicMedia"),
    };
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** `sites/<id>/<file>.png` → `sites/<id>/variants/<file>-<w>.<fmt>`. */
function variantKey(storageKey: string, width: number, format: string): string {
  const slash = storageKey.lastIndexOf("/");
  const dir = slash >= 0 ? storageKey.slice(0, slash) : "";
  const file = (slash >= 0 ? storageKey.slice(slash + 1) : storageKey).replace(/\.[^.]+$/, "");
  return `${dir ? `${dir}/` : ""}variants/${file}-${width}.${format}`;
}

export async function processImage(
  job: Job<ImageProcessJobData>,
): Promise<{ ok: boolean; variants: number }> {
  const { mediaId, storageKey, crop } = job.data;

  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row) return { ok: false, variants: 0 };
  if (!row.type.startsWith("image/")) {
    // Non-image asset: nothing to derive, just settle the lifecycle.
    await db.update(media).set({ status: "ready" }).where(eq(media.id, mediaId));
    return { ok: true, variants: 0 };
  }

  const sharp = await loadSharp();
  const s3 = await loadS3();

  // Graceful degradation: without the native libs we can't produce derivatives,
  // but the row must still settle so the admin doesn't show it stuck.
  if (!sharp || !s3) {
    console.warn(
      `[worker:image-process] sharp/@aws-sdk not installed — skipping derivatives for ${mediaId}. ` +
        `Run 'cd apps/worker && bun add sharp @aws-sdk/client-s3' to enable.`,
    );
    await db.update(media).set({ status: "ready" }).where(eq(media.id, mediaId));
    return { ok: true, variants: 0 };
  }

  const source = await s3.get(storageKey);
  let pipeline = sharp(source, { failOn: "none" });

  if (crop) {
    pipeline = sharp(
      await pipeline
        .extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h })
        .toBuffer(),
    );
  }

  const meta = await pipeline.metadata();
  const intrinsicWidth: number = meta.width ?? 0;
  const intrinsicHeight: number = meta.height ?? 0;

  const variants: MediaVariant[] = [];
  const widths = TARGET_WIDTHS.filter((w) => w <= intrinsicWidth || w === TARGET_WIDTHS[0]);

  for (const width of widths) {
    for (const format of NEXTGEN_FORMATS) {
      const key = variantKey(storageKey, width, format);
      const buffer: Buffer = await pipeline
        .clone()
        .resize({ width, withoutEnlargement: true })
        .toFormat(format)
        .toBuffer();
      await s3.put(key, buffer, `image/${format}`);
      variants.push({
        width: Math.min(width, intrinsicWidth || width),
        format,
        url: s3.publicUrl(key),
        bytes: buffer.length,
      });
    }
  }

  await db
    .update(media)
    .set({
      width: intrinsicWidth,
      height: intrinsicHeight,
      variants,
      status: "ready",
    })
    .where(eq(media.id, mediaId));

  return { ok: true, variants: variants.length };
}
