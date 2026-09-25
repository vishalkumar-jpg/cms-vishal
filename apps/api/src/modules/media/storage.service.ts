import { Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  loadPlatformConfig,
  type PlatformConfig,
  type PlatformEnvironment,
  type StorageTargetName,
} from "@ob-cms/config/platform-config";

type ObjectStorageConfig = PlatformConfig["objectStorage"];

/**
 * Object storage adapter (S3-compatible). Client settings and logical targets
 * come from {@link loadPlatformConfig} so legacy `S3_*` and provider-neutral
 * `OBJECT_STORAGE_*` variables share one normalization path. We presign a PUT
 * for the browser to upload directly (no bytes through the API), then the
 * client calls /confirm. `forcePathStyle` is required when an explicit endpoint
 * is set (MinIO / path-style S3-compatible providers).
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly objectStorage: ObjectStorageConfig;

  constructor() {
    this.objectStorage = loadObjectStorage(process.env);
    this.client = createS3Client(this.objectStorage);
  }

  /** Build a deterministic, tenant-namespaced storage key. */
  buildKey(siteId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
    return `sites/${siteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  }

  /** Presigned PUT URL for a direct browser upload. */
  async presignUpload(
    key: string,
    contentType: string,
    expiresIn = 900,
    target: StorageTargetName = "publicMedia",
  ): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucketFor(target),
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  /** Short-lived presigned GET URL for downloading a private (or any) object. */
  async presignDownload(
    key: string,
    expiresIn = 900,
    target: StorageTargetName = "publicMedia",
  ): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucketFor(target),
      Key: key,
    });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  /**
   * Public/read URL for an object. Private targets only expose a URL in
   * `OBJECT_STORAGE_MODE=shared`, where they share the public-media base URL
   * (legacy single-bucket behavior). Isolated private targets have no public
   * URL and must not reuse the media CDN/base — use {@link resolveObjectUrl}
   * or {@link presignDownload} instead.
   */
  publicUrl(key: string, target: StorageTargetName = "publicMedia"): string {
    return resolvePublicObjectUrl(this.objectStorage, key, target);
  }

  /**
   * Read URL for a storage target: stable public base when the target exposes
   * one (public media; private targets in shared mode), otherwise a short-lived
   * presigned GET for isolated private buckets.
   */
  async resolveObjectUrl(
    key: string,
    target: StorageTargetName = "publicMedia",
    expiresIn = 900,
  ): Promise<string> {
    if (canResolvePublicObjectUrl(this.objectStorage, target)) {
      return resolvePublicObjectUrl(this.objectStorage, key, target);
    }
    return this.presignDownload(key, expiresIn, target);
  }

  /** Server-side upload (import/migration paths — not browser presign). */
  async putObject(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
    target: StorageTargetName = "publicMedia",
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketFor(target),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string, target: StorageTargetName = "publicMedia"): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucketFor(target), Key: key }),
    );
  }

  private bucketFor(target: StorageTargetName): string {
    return this.objectStorage.targets[target].bucket;
  }
}

/** @internal Exported for upload/presign regression tests. */
export function loadObjectStorage(environment: PlatformEnvironment): ObjectStorageConfig {
  return loadPlatformConfig(environment).objectStorage;
}

/** @internal Exported for upload/presign regression tests. */
export function createS3Client(objectStorage: ObjectStorageConfig): S3Client {
  const endpoint = objectStorage.endpoint ?? undefined;
  return new S3Client({
    region: objectStorage.region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: objectStorage.accessKeyId,
      secretAccessKey: objectStorage.secretAccessKey,
    },
  });
}

/** @internal Exported for upload/presign regression tests. */
export function canResolvePublicObjectUrl(
  objectStorage: ObjectStorageConfig,
  target: StorageTargetName = "publicMedia",
): boolean {
  if (objectStorage.targets[target].publicUrl != null) return true;
  return (
    objectStorage.mode === "shared" && objectStorage.targets.publicMedia.publicUrl != null
  );
}

/** @internal Exported for upload/presign regression tests. */
export function resolvePublicObjectUrl(
  objectStorage: ObjectStorageConfig,
  key: string,
  target: StorageTargetName = "publicMedia",
): string {
  if (!canResolvePublicObjectUrl(objectStorage, target)) {
    throw new Error(
      `Storage target "${target}" has no public URL; configure OBJECT_STORAGE_PUBLIC_MEDIA_URL (or S3_PUBLIC_URL) or use shared object-storage mode`,
    );
  }

  const configured = objectStorage.targets[target].publicUrl;
  const base =
    configured ??
    (objectStorage.mode === "shared" ? objectStorage.targets.publicMedia.publicUrl : null);

  // canResolvePublicObjectUrl guarantees a non-null base.
  return `${base}/${key}`;
}
