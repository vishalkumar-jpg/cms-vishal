import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import {
  DEFAULT_OBJECT_STORAGE_PROVIDER,
  INSECURE_STORAGE_DEFAULT,
  isSupportedObjectStorageProvider,
  OBJECT_STORAGE_ENV_KEYS,
  unsupportedObjectStorageProviderMessage,
} from "./object-storage.constants";

/**
 * Env loading + validation (WAVE4b).
 *
 * Walk UP from the process cwd to the FIRST `.env` (the monorepo root) and load
 * it, so a SINGLE root `.env` powers `bun run dev` for the API without per-app
 * copies. Docker is unaffected: compose injects env and dotenv never overrides
 * already-set process.env values.
 */
function findEnvFile(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envPath = findEnvFile(process.cwd());
config(envPath ? { path: envPath } : undefined);

export function getOsEnv(key: string): string {
  return process.env[key] ?? "";
}

export function getOsEnvOptional(key: string): string | undefined {
  return process.env[key];
}

const INSECURE_JWT_SECRET = "change-me-in-production";

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readWithLegacyTrimmed(
  env: NodeJS.ProcessEnv,
  primary: string,
  legacy: string,
): string | undefined {
  return readTrimmed(env, primary) ?? readTrimmed(env, legacy);
}

/**
 * Fail-fast checks for staging/production deployments. Kept dependency-free so
 * the API boot path does not import @ob-cms/config (mirrors platform-config rules).
 */
function assertDeployedEnv(env: NodeJS.ProcessEnv, environment: "staging" | "production"): void {
  const errors: string[] = [];
  const label = environment === "staging" ? "staging" : "production";

  const jwtSecret = readTrimmed(env, "JWT_SECRET");
  if (!jwtSecret || jwtSecret === INSECURE_JWT_SECRET) {
    errors.push(`JWT_SECRET must be set to a strong value in ${label}`);
  }

  if (!readTrimmed(env, "ENCRYPTION_KEY") && !readTrimmed(env, "KMS_DATA_KEY")) {
    errors.push(`ENCRYPTION_KEY (or KMS_DATA_KEY) is required in ${label}`);
  }

  if (!readTrimmed(env, "REVALIDATE_SECRET")) {
    errors.push(`REVALIDATE_SECRET is required in ${label}`);
  }

  if (!readTrimmed(env, "REDIS_HOST")) {
    errors.push(`REDIS_HOST is required in ${label}`);
  }

  const storageProvider =
    readTrimmed(env, OBJECT_STORAGE_ENV_KEYS.provider) ?? DEFAULT_OBJECT_STORAGE_PROVIDER;
  const accessKeyId = readWithLegacyTrimmed(
    env,
    OBJECT_STORAGE_ENV_KEYS.accessKeyId,
    OBJECT_STORAGE_ENV_KEYS.accessKeyIdLegacy,
  );
  const secretAccessKey = readWithLegacyTrimmed(
    env,
    OBJECT_STORAGE_ENV_KEYS.secretAccessKey,
    OBJECT_STORAGE_ENV_KEYS.secretAccessKeyLegacy,
  );
  const bucket = readWithLegacyTrimmed(
    env,
    OBJECT_STORAGE_ENV_KEYS.bucket,
    OBJECT_STORAGE_ENV_KEYS.bucketLegacy,
  );
  const publicMediaUrl = readWithLegacyTrimmed(
    env,
    OBJECT_STORAGE_ENV_KEYS.publicMediaUrl,
    OBJECT_STORAGE_ENV_KEYS.publicMediaUrlLegacy,
  );
  const region = readWithLegacyTrimmed(
    env,
    OBJECT_STORAGE_ENV_KEYS.region,
    OBJECT_STORAGE_ENV_KEYS.regionLegacy,
  );
  const endpoint = readWithLegacyTrimmed(
    env,
    OBJECT_STORAGE_ENV_KEYS.endpoint,
    OBJECT_STORAGE_ENV_KEYS.endpointLegacy,
  );

  if (!isSupportedObjectStorageProvider(storageProvider)) {
    errors.push(unsupportedObjectStorageProviderMessage(storageProvider));
  } else if (storageProvider === "s3") {
    if (!region || region === "auto") {
      errors.push(
        `OBJECT_STORAGE_REGION must be set to a valid AWS region for native S3 in ${label}`,
      );
    }
  } else if (storageProvider === "minio" || storageProvider === "r2") {
    if (!endpoint) {
      errors.push(
        `OBJECT_STORAGE_ENDPOINT (or S3_ENDPOINT) is required for ${storageProvider} storage in ${label}`,
      );
    }
  }

  if (!accessKeyId || accessKeyId === INSECURE_STORAGE_DEFAULT) {
    errors.push(
      `OBJECT_STORAGE_ACCESS_KEY_ID (or S3_ACCESS_KEY) is required in ${label}`,
    );
  }
  if (!secretAccessKey || secretAccessKey === INSECURE_STORAGE_DEFAULT) {
    errors.push(
      `OBJECT_STORAGE_SECRET_ACCESS_KEY (or S3_SECRET_KEY) is required in ${label}`,
    );
  }
  if (!bucket) {
    errors.push(`OBJECT_STORAGE_BUCKET (or S3_BUCKET) is required in ${label}`);
  }
  if (!publicMediaUrl) {
    errors.push(
      `OBJECT_STORAGE_PUBLIC_MEDIA_URL (or S3_PUBLIC_URL) is required in ${label}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}

/**
 * Fail-fast validation of required env at boot (WAVE4b). Mirrors the shape of
 * the shared zod schema in packages/config (kept in sync) but stays dependency-
 * free so it runs under the API's swc/node runtime without importing that ESM
 * source package. Aggregates every problem into one clear error, and treats a
 * weak/default JWT secret in production as fatal.
 */
export function assertRequiredEnv(): void {
  const env = process.env;
  const errors: string[] = [];

  // Required, non-empty.
  if (!env.DATABASE_URL || env.DATABASE_URL.trim().length === 0) {
    errors.push("DATABASE_URL is required");
  }

  const environment = env.ENVIRONMENT ?? "local";
  if (!["local", "development", "staging", "production"].includes(environment)) {
    errors.push(`ENVIRONMENT must be one of local|development|staging|production (got ${environment})`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  if (environment === "staging" || environment === "production") {
    assertDeployedEnv(env, environment);
  }
}
