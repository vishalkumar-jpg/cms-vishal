/** Dependency-free object-storage env keys and provider constants for API boot validation. */
export const OBJECT_STORAGE_ENV_KEYS = {
  provider: "OBJECT_STORAGE_PROVIDER",
  accessKeyId: "OBJECT_STORAGE_ACCESS_KEY_ID",
  accessKeyIdLegacy: "S3_ACCESS_KEY",
  secretAccessKey: "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  secretAccessKeyLegacy: "S3_SECRET_KEY",
  bucket: "OBJECT_STORAGE_BUCKET",
  bucketLegacy: "S3_BUCKET",
  publicMediaUrl: "OBJECT_STORAGE_PUBLIC_MEDIA_URL",
  publicMediaUrlLegacy: "S3_PUBLIC_URL",
  region: "OBJECT_STORAGE_REGION",
  regionLegacy: "S3_REGION",
  endpoint: "OBJECT_STORAGE_ENDPOINT",
  endpointLegacy: "S3_ENDPOINT",
} as const;

export const OBJECT_STORAGE_PROVIDERS = ["s3", "minio", "r2"] as const;
export type ObjectStorageProvider = (typeof OBJECT_STORAGE_PROVIDERS)[number];

export const DEFAULT_OBJECT_STORAGE_PROVIDER: ObjectStorageProvider = "s3";

/** Default MinIO credentials — rejected in staging/production deployments. */
export const INSECURE_STORAGE_DEFAULT = "minioadmin";

export function isSupportedObjectStorageProvider(
  value: string,
): value is ObjectStorageProvider {
  return (OBJECT_STORAGE_PROVIDERS as readonly string[]).includes(value);
}

export function unsupportedObjectStorageProviderMessage(provider: string): string {
  return `OBJECT_STORAGE_PROVIDER must be one of ${OBJECT_STORAGE_PROVIDERS.join(", ")} (got ${provider})`;
}
