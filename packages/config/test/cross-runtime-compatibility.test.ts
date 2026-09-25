import { describe, expect, it } from "bun:test";
import {
  loadObjectStorage,
  createS3Client,
} from "../../../apps/api/src/modules/media/storage.service";
import {
  loadWorkerObjectStorage,
  loadWorkerPlatformConfig,
  objectStorageClientOptions,
} from "../../../apps/worker/src/platform-storage";
import {
  loadPlatformConfig,
  PlatformConfigError,
  type PlatformConfig,
  type PlatformEnvironment,
} from "../src/platform-config";

/**
 * Issue #9 — prove API and worker consumers resolve equivalent normalized
 * settings from the same environment through `loadPlatformConfig`. No live
 * Cloudflare, AWS, R2, DNS, or object-storage credentials are used.
 *
 * Fixture `expected` values are handwritten oracles (not derived from the
 * loader) so precedence/default regressions cannot be masked.
 */

const DEFAULT_SHARED_STORAGE = {
  provider: "s3",
  mode: "shared",
  endpoint: null,
  region: "us-east-1",
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
  targets: {
    publicMedia: {
      bucket: "ob-cms-media",
      visibility: "public",
      publicUrl: "https://ob-cms-media.s3.amazonaws.com",
    },
    privateFormAttachments: {
      bucket: "ob-cms-media",
      visibility: "private",
      publicUrl: null,
    },
    privateBackups: {
      bucket: "ob-cms-media",
      visibility: "private",
      publicUrl: null,
    },
  },
} as const satisfies PlatformConfig["objectStorage"];

const DEFAULT_CAPABILITIES = {
  purge: { enabled: false, scopeId: null },
  customHostnames: { enabled: false, scopeId: null },
} as const satisfies PlatformConfig["capabilities"];

const FIXTURES: ReadonlyArray<{
  name: string;
  environment: PlatformEnvironment;
  expected: PlatformConfig;
}> = [
  {
    name: "empty / new variables absent",
    environment: {},
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: DEFAULT_SHARED_STORAGE,
    },
  },
  {
    name: "legacy S3_* MinIO-style deployment",
    environment: {
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      S3_BUCKET: "ob-cms-media",
      S3_PUBLIC_URL: "http://localhost:9000/ob-cms-media",
    },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: {
        provider: "s3",
        mode: "shared",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        accessKeyId: "minioadmin",
        secretAccessKey: "minioadmin",
        targets: {
          publicMedia: {
            bucket: "ob-cms-media",
            visibility: "public",
            publicUrl: "http://localhost:9000/ob-cms-media",
          },
          privateFormAttachments: {
            bucket: "ob-cms-media",
            visibility: "private",
            publicUrl: null,
          },
          privateBackups: {
            bucket: "ob-cms-media",
            visibility: "private",
            publicUrl: null,
          },
        },
      },
    },
  },
  {
    name: "provider-neutral variables take precedence over S3_*",
    environment: {
      OBJECT_STORAGE_PROVIDER: "minio",
      OBJECT_STORAGE_ENDPOINT: "http://minio.internal:9000",
      OBJECT_STORAGE_REGION: "eu-west-1",
      OBJECT_STORAGE_ACCESS_KEY_ID: "neutral-key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "neutral-secret",
      OBJECT_STORAGE_BUCKET: "neutral-media",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example/media",
      S3_ENDPOINT: "http://legacy:9000",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY: "legacy-key",
      S3_SECRET_KEY: "legacy-secret",
      S3_BUCKET: "legacy-media",
      S3_PUBLIC_URL: "https://legacy.example/media",
    },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: {
        provider: "minio",
        mode: "shared",
        endpoint: "http://minio.internal:9000",
        region: "eu-west-1",
        accessKeyId: "neutral-key",
        secretAccessKey: "neutral-secret",
        targets: {
          publicMedia: {
            bucket: "neutral-media",
            visibility: "public",
            publicUrl: "https://cdn.example/media",
          },
          privateFormAttachments: {
            bucket: "neutral-media",
            visibility: "private",
            publicUrl: null,
          },
          privateBackups: {
            bucket: "neutral-media",
            visibility: "private",
            publicUrl: null,
          },
        },
      },
    },
  },
  {
    name: "edge provider none (explicit)",
    environment: { EDGE_PROVIDER: "none" },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: DEFAULT_SHARED_STORAGE,
    },
  },
  {
    name: "edge provider cloudfront",
    environment: { EDGE_PROVIDER: "cloudfront" },
    expected: {
      edge: { provider: "cloudfront" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: DEFAULT_SHARED_STORAGE,
    },
  },
  {
    name: "edge provider cloudflare without capabilities",
    environment: { EDGE_PROVIDER: "cloudflare" },
    expected: {
      edge: { provider: "cloudflare" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: DEFAULT_SHARED_STORAGE,
    },
  },
  {
    name: "cloudflare purge capability only",
    environment: {
      EDGE_PROVIDER: "cloudflare",
      CLOUDFLARE_PURGE_ENABLED: "true",
      CLOUDFLARE_ZONE_ID: "zone-purge",
    },
    expected: {
      edge: { provider: "cloudflare" },
      capabilities: {
        purge: { enabled: true, scopeId: "zone-purge" },
        customHostnames: { enabled: false, scopeId: null },
      },
      objectStorage: DEFAULT_SHARED_STORAGE,
    },
  },
  {
    name: "cloudflare custom hostnames capability only",
    environment: {
      EDGE_PROVIDER: "cloudflare",
      CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED: "true",
      CLOUDFLARE_ZONE_ID: "zone-hostnames",
    },
    expected: {
      edge: { provider: "cloudflare" },
      capabilities: {
        purge: { enabled: false, scopeId: null },
        customHostnames: { enabled: true, scopeId: "zone-hostnames" },
      },
      objectStorage: DEFAULT_SHARED_STORAGE,
    },
  },
  {
    name: "object storage provider s3 (explicit)",
    environment: { OBJECT_STORAGE_PROVIDER: "s3" },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: DEFAULT_SHARED_STORAGE,
    },
  },
  {
    name: "object storage provider minio",
    environment: {
      OBJECT_STORAGE_PROVIDER: "minio",
      OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
      OBJECT_STORAGE_ACCESS_KEY_ID: "minio-key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "minio-secret",
    },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: {
        provider: "minio",
        mode: "shared",
        endpoint: "http://minio:9000",
        region: "us-east-1",
        accessKeyId: "minio-key",
        secretAccessKey: "minio-secret",
        targets: {
          publicMedia: {
            bucket: "ob-cms-media",
            visibility: "public",
            publicUrl: "http://minio:9000/ob-cms-media",
          },
          privateFormAttachments: {
            bucket: "ob-cms-media",
            visibility: "private",
            publicUrl: null,
          },
          privateBackups: {
            bucket: "ob-cms-media",
            visibility: "private",
            publicUrl: null,
          },
        },
      },
    },
  },
  {
    name: "object storage provider r2",
    environment: {
      OBJECT_STORAGE_PROVIDER: "r2",
      OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-secret",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example",
    },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: {
        provider: "r2",
        mode: "shared",
        endpoint: "https://account.r2.cloudflarestorage.com",
        region: "auto",
        accessKeyId: "r2-access",
        secretAccessKey: "r2-secret",
        targets: {
          publicMedia: {
            bucket: "ob-cms-media",
            visibility: "public",
            publicUrl: "https://cdn.example",
          },
          privateFormAttachments: {
            bucket: "ob-cms-media",
            visibility: "private",
            publicUrl: null,
          },
          privateBackups: {
            bucket: "ob-cms-media",
            visibility: "private",
            publicUrl: null,
          },
        },
      },
    },
  },
  {
    name: "shared mode with explicit bucket",
    environment: {
      OBJECT_STORAGE_MODE: "shared",
      OBJECT_STORAGE_BUCKET: "shared-bucket",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://shared.example/media",
    },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: {
        provider: "s3",
        mode: "shared",
        endpoint: null,
        region: "us-east-1",
        accessKeyId: "minioadmin",
        secretAccessKey: "minioadmin",
        targets: {
          publicMedia: {
            bucket: "shared-bucket",
            visibility: "public",
            publicUrl: "https://shared.example/media",
          },
          privateFormAttachments: {
            bucket: "shared-bucket",
            visibility: "private",
            publicUrl: null,
          },
          privateBackups: {
            bucket: "shared-bucket",
            visibility: "private",
            publicUrl: null,
          },
        },
      },
    },
  },
  {
    name: "isolated logical storage targets",
    environment: {
      OBJECT_STORAGE_MODE: "isolated",
      OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
      OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET: "forms",
      OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET: "backups",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example/media",
      OBJECT_STORAGE_ACCESS_KEY_ID: "key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret",
    },
    expected: {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: {
        provider: "s3",
        mode: "isolated",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        accessKeyId: "key",
        secretAccessKey: "secret",
        targets: {
          publicMedia: {
            bucket: "media",
            visibility: "public",
            publicUrl: "https://cdn.example/media",
          },
          privateFormAttachments: {
            bucket: "forms",
            visibility: "private",
            publicUrl: null,
          },
          privateBackups: {
            bucket: "backups",
            visibility: "private",
            publicUrl: null,
          },
        },
      },
    },
  },
];

const INVALID_FIXTURES: ReadonlyArray<{
  name: string;
  environment: PlatformEnvironment;
  expectedMessage: string;
}> = [
  {
    name: "unknown edge provider",
    environment: { EDGE_PROVIDER: "fast-edge" },
    expectedMessage: "EDGE_PROVIDER must be one of none, cloudfront, cloudflare",
  },
  {
    name: "unknown storage provider",
    environment: { OBJECT_STORAGE_PROVIDER: "swift" },
    expectedMessage: "OBJECT_STORAGE_PROVIDER must be one of s3, minio, r2",
  },
  {
    name: "incomplete isolated targets",
    environment: {
      OBJECT_STORAGE_MODE: "isolated",
      OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
    },
    expectedMessage: "OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET is required",
  },
  {
    name: "cloudflare capability without zone",
    environment: {
      EDGE_PROVIDER: "cloudflare",
      CLOUDFLARE_PURGE_ENABLED: "true",
    },
    expectedMessage: "CLOUDFLARE_ZONE_ID is required when CLOUDFLARE_PURGE_ENABLED is true",
  },
  {
    name: "r2 without endpoint",
    environment: {
      OBJECT_STORAGE_PROVIDER: "r2",
      OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-secret",
    },
    expectedMessage: "OBJECT_STORAGE_ENDPOINT (or S3_ENDPOINT) is required for r2 storage",
  },
];

async function expectApiClientMatchesWorker(
  apiClient: ReturnType<typeof createS3Client>,
  workerClient: ReturnType<typeof objectStorageClientOptions>,
): Promise<void> {
  expect(apiClient.config.forcePathStyle).toBe(workerClient.forcePathStyle);
  expect(await apiClient.config.region()).toBe(workerClient.region);

  const credentials = await apiClient.config.credentials();
  expect(credentials.accessKeyId).toBe(workerClient.credentials.accessKeyId);
  expect(credentials.secretAccessKey).toBe(workerClient.credentials.secretAccessKey);

  if (workerClient.endpoint == null) {
    expect(apiClient.config.forcePathStyle).toBe(false);
    return;
  }

  const resolved = await apiClient.config.endpoint!();
  const expected = new URL(workerClient.endpoint);
  expect(resolved.protocol).toBe(expected.protocol);
  expect(resolved.hostname).toBe(expected.hostname);
  expect(resolved.port).toBe(expected.port === "" ? undefined : Number(expected.port));
}

describe("API / worker cross-runtime platform config compatibility", () => {
  for (const fixture of FIXTURES) {
    it(`resolves equivalent normalized settings for ${fixture.name}`, async () => {
      const loader = loadPlatformConfig(fixture.environment);
      const workerPlatform = loadWorkerPlatformConfig(fixture.environment);
      const workerStorage = loadWorkerObjectStorage(fixture.environment);
      const apiStorage = loadObjectStorage(fixture.environment);

      expect(loader).toEqual(fixture.expected);
      expect(workerPlatform).toEqual(fixture.expected);
      expect(workerStorage).toEqual(fixture.expected.objectStorage);
      expect(apiStorage).toEqual(fixture.expected.objectStorage);
      expect(apiStorage).toEqual(workerStorage);

      const workerClient = objectStorageClientOptions(workerStorage);
      expect(workerClient).toEqual({
        region: fixture.expected.objectStorage.region,
        endpoint: fixture.expected.objectStorage.endpoint ?? undefined,
        forcePathStyle: Boolean(fixture.expected.objectStorage.endpoint),
        credentials: {
          accessKeyId: fixture.expected.objectStorage.accessKeyId,
          secretAccessKey: fixture.expected.objectStorage.secretAccessKey,
        },
      });

      await expectApiClientMatchesWorker(createS3Client(apiStorage), workerClient);
    });
  }

  it("preserves established defaults when new variables are absent", () => {
    const expected: PlatformConfig = {
      edge: { provider: "none" },
      capabilities: DEFAULT_CAPABILITIES,
      objectStorage: DEFAULT_SHARED_STORAGE,
    };

    expect(loadPlatformConfig({})).toEqual(expected);
    expect(loadWorkerPlatformConfig({})).toEqual(expected);
    expect(loadObjectStorage({})).toEqual(expected.objectStorage);
  });

  for (const fixture of INVALID_FIXTURES) {
    it(`surfaces the same safe validation failure for ${fixture.name}`, () => {
      let loaderError: unknown;
      let apiError: unknown;
      let workerError: unknown;

      try {
        loadPlatformConfig(fixture.environment);
      } catch (error) {
        loaderError = error;
      }
      try {
        loadObjectStorage(fixture.environment);
      } catch (error) {
        apiError = error;
      }
      try {
        loadWorkerObjectStorage(fixture.environment);
      } catch (error) {
        workerError = error;
      }

      expect(loaderError).toBeInstanceOf(PlatformConfigError);
      expect(apiError).toBeInstanceOf(PlatformConfigError);
      expect(workerError).toBeInstanceOf(PlatformConfigError);

      const loaderMessage = (loaderError as Error).message;
      expect(loaderMessage).toContain(fixture.expectedMessage);
      expect((apiError as Error).message).toBe(loaderMessage);
      expect((workerError as Error).message).toBe(loaderMessage);
    });
  }

  it("never leaks secret values through any consumer validation path", () => {
    const secret = "do-not-log-this-cross-runtime-secret";
    const environment: PlatformEnvironment = {
      EDGE_PROVIDER: secret,
      OBJECT_STORAGE_SECRET_ACCESS_KEY: secret,
      CLOUDFLARE_PURGE_ENABLED: secret,
    };

    for (const load of [
      () => loadPlatformConfig(environment),
      () => loadObjectStorage(environment),
      () => loadWorkerObjectStorage(environment),
      () => loadWorkerPlatformConfig(environment),
    ]) {
      try {
        load();
        throw new Error("expected validation failure");
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformConfigError);
        expect(String(error)).not.toContain(secret);
        expect(JSON.stringify(error)).not.toContain(secret);
      }
    }
  });
});
