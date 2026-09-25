import { afterEach, describe, expect, it } from "bun:test";
import { assertRequiredEnv } from "../env.config";
import {
  DEFAULT_OBJECT_STORAGE_PROVIDER,
  INSECURE_STORAGE_DEFAULT,
  OBJECT_STORAGE_ENV_KEYS,
} from "../object-storage.constants";

const BASE_STAGING_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/uat",
  ENVIRONMENT: "staging",
  JWT_SECRET: "staging-jwt-secret-value",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  REVALIDATE_SECRET: "staging-revalidate-secret",
  REDIS_HOST: "redis.example.com",
  [OBJECT_STORAGE_ENV_KEYS.provider]: DEFAULT_OBJECT_STORAGE_PROVIDER,
  [OBJECT_STORAGE_ENV_KEYS.region]: "us-east-1",
  [OBJECT_STORAGE_ENV_KEYS.accessKeyId]: "AKIAEXAMPLE",
  [OBJECT_STORAGE_ENV_KEYS.secretAccessKey]: "secret-access-key",
  [OBJECT_STORAGE_ENV_KEYS.bucket]: "uat-cms-media",
  [OBJECT_STORAGE_ENV_KEYS.publicMediaUrl]: "https://cdn.example.com/media",
};

const snapshotEnv = (): NodeJS.ProcessEnv => ({ ...process.env });

describe("assertRequiredEnv", () => {
  let savedEnv: NodeJS.ProcessEnv;

  afterEach(() => {
    process.env = savedEnv;
  });

  it("allows local development with minimal configuration", () => {
    savedEnv = snapshotEnv();
    process.env = {
      DATABASE_URL: "postgresql://obcms:obcms@localhost:5432/obcms",
      ENVIRONMENT: "local",
    };
    expect(() => assertRequiredEnv()).not.toThrow();
  });

  it("fails staging boot when required deployment secrets are missing", () => {
    savedEnv = snapshotEnv();
    process.env = {
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/uat",
      ENVIRONMENT: "staging",
    };
    expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET/);
    expect(() => assertRequiredEnv()).toThrow(/REVALIDATE_SECRET/);
    expect(() => assertRequiredEnv()).toThrow(/REDIS_HOST/);
    expect(() => assertRequiredEnv()).toThrow(/OBJECT_STORAGE_ACCESS_KEY_ID/);
  });

  it("passes staging boot when required deployment configuration is present", () => {
    savedEnv = snapshotEnv();
    process.env = { ...BASE_STAGING_ENV };
    expect(() => assertRequiredEnv()).not.toThrow();
  });

  it("rejects native S3 staging config when region is auto", () => {
    savedEnv = snapshotEnv();
    process.env = {
      ...BASE_STAGING_ENV,
      [OBJECT_STORAGE_ENV_KEYS.region]: "auto",
    };
    expect(() => assertRequiredEnv()).toThrow(/OBJECT_STORAGE_REGION/);
  });

  it("rejects insecure default storage credentials in staging", () => {
    savedEnv = snapshotEnv();
    process.env = {
      ...BASE_STAGING_ENV,
      [OBJECT_STORAGE_ENV_KEYS.accessKeyId]: INSECURE_STORAGE_DEFAULT,
      [OBJECT_STORAGE_ENV_KEYS.secretAccessKey]: INSECURE_STORAGE_DEFAULT,
    };
    expect(() => assertRequiredEnv()).toThrow(/OBJECT_STORAGE_ACCESS_KEY_ID/);
    expect(() => assertRequiredEnv()).toThrow(/OBJECT_STORAGE_SECRET_ACCESS_KEY/);
  });

  it("rejects unsupported object storage providers in staging", () => {
    savedEnv = snapshotEnv();
    process.env = {
      ...BASE_STAGING_ENV,
      [OBJECT_STORAGE_ENV_KEYS.provider]: "swift",
    };
    expect(() => assertRequiredEnv()).toThrow(
      /OBJECT_STORAGE_PROVIDER must be one of s3, minio, r2 \(got swift\)/,
    );
  });
});
