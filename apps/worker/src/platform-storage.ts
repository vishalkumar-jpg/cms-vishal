import {
  loadPlatformConfig,
  type PlatformConfig,
  type PlatformEnvironment,
  type StorageTargetName,
} from "@ob-cms/config/platform-config";

export type ObjectStorageConfig = PlatformConfig["objectStorage"];

/**
 * Worker seam over Issue #5's pure loader. Parsing and precedence live only in
 * `loadPlatformConfig` — this module never re-reads `S3_*` / `OBJECT_STORAGE_*`
 * variables. Loading the full platform config also surfaces edge/capability
 * settings without performing purge, DNS, TLS, or Cloudflare network I/O.
 */
export function loadWorkerPlatformConfig(
  environment: PlatformEnvironment = process.env,
): PlatformConfig {
  return loadPlatformConfig(environment);
}

export function loadWorkerObjectStorage(
  environment: PlatformEnvironment = process.env,
): ObjectStorageConfig {
  return loadWorkerPlatformConfig(environment).objectStorage;
}

/** S3 client options aligned with the API StorageService constructor. */
export function objectStorageClientOptions(objectStorage: ObjectStorageConfig): {
  region: string;
  endpoint: string | undefined;
  forcePathStyle: boolean;
  credentials: { accessKeyId: string; secretAccessKey: string };
} {
  const endpoint = objectStorage.endpoint ?? undefined;
  return {
    region: objectStorage.region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: objectStorage.accessKeyId,
      secretAccessKey: objectStorage.secretAccessKey,
    },
  };
}

export function bucketForTarget(
  objectStorage: ObjectStorageConfig,
  target: StorageTargetName,
): string {
  return objectStorage.targets[target].bucket;
}

/**
 * Public URL for a target. Shared-mode private targets reuse the public-media
 * base (legacy single-bucket). Isolated private targets have no public base.
 */
export function resolvePublicObjectUrl(
  objectStorage: ObjectStorageConfig,
  key: string,
  target: StorageTargetName = "publicMedia",
): string {
  const configured = objectStorage.targets[target].publicUrl;
  const base =
    configured ??
    (objectStorage.mode === "shared" ? objectStorage.targets.publicMedia.publicUrl : null);

  if (base == null) {
    throw new Error(
      `Storage target "${target}" has no public URL; configure OBJECT_STORAGE_PUBLIC_MEDIA_URL (or S3_PUBLIC_URL). Shared mode only reuses that configured public-media URL.`,
    );
  }

  return `${base}/${key}`;
}
