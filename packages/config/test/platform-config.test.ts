import { describe, expect, it } from "bun:test";
import {
  loadPlatformConfig,
  PlatformConfigError,
  type EdgeProvider,
  type ObjectStorageProvider,
} from "../src/platform-config";

describe("loadPlatformConfig", () => {
  it("preserves the legacy defaults when no new variables are present", () => {
    const config = loadPlatformConfig({});

    expect(config).toEqual({
      edge: { provider: "none" },
      capabilities: {
        purge: { enabled: false, scopeId: null },
        customHostnames: { enabled: false, scopeId: null },
      },
      objectStorage: {
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
      },
    });
  });

  it("accepts every supported edge provider without enabling capabilities", () => {
    for (const provider of ["none", "cloudfront", "cloudflare"] satisfies EdgeProvider[]) {
      const config = loadPlatformConfig({ EDGE_PROVIDER: provider });
      expect(config.edge.provider).toBe(provider);
      expect(config.capabilities.purge.enabled).toBe(false);
      expect(config.capabilities.customHostnames.enabled).toBe(false);
    }
  });

  it("accepts every supported object-storage provider", () => {
    const environments: Record<ObjectStorageProvider, Record<string, string>> = {
      s3: {},
      minio: { OBJECT_STORAGE_ENDPOINT: "http://minio:9000" },
      r2: {
        OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-secret",
      },
    };

    for (const provider of ["s3", "minio", "r2"] satisfies ObjectStorageProvider[]) {
      const config = loadPlatformConfig({
        OBJECT_STORAGE_PROVIDER: provider,
        ...environments[provider],
      });
      expect(config.objectStorage.provider).toBe(provider);
      expect(config.objectStorage.region).toBe(provider === "r2" ? "auto" : "us-east-1");
    }
  });

  it("keeps Cloudflare capabilities independently selectable", () => {
    const purgeOnly = loadPlatformConfig({
      EDGE_PROVIDER: "cloudflare",
      CLOUDFLARE_PURGE_ENABLED: "true",
      CLOUDFLARE_ZONE_ID: "zone-id",
    });
    expect(purgeOnly.capabilities.purge).toEqual({ enabled: true, scopeId: "zone-id" });
    expect(purgeOnly.capabilities.customHostnames.enabled).toBe(false);

    const hostnamesOnly = loadPlatformConfig({
      EDGE_PROVIDER: "cloudflare",
      CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED: "true",
      CLOUDFLARE_ZONE_ID: "zone-id",
    });
    expect(hostnamesOnly.capabilities.purge.enabled).toBe(false);
    expect(hostnamesOnly.capabilities.customHostnames).toEqual({
      enabled: true,
      scopeId: "zone-id",
    });
  });

  it("normalizes legacy S3 variables", () => {
    const config = loadPlatformConfig({
      S3_ENDPOINT: "http://legacy-minio:9000",
      S3_REGION: "legacy-region",
      S3_ACCESS_KEY: "legacy-access",
      S3_SECRET_KEY: "legacy-secret",
      S3_BUCKET: "legacy-bucket",
      S3_PUBLIC_URL: "https://legacy.example/media",
    });

    expect(config.objectStorage).toMatchObject({
      endpoint: "http://legacy-minio:9000",
      region: "legacy-region",
      accessKeyId: "legacy-access",
      secretAccessKey: "legacy-secret",
    });
    expect(config.objectStorage.targets.publicMedia).toMatchObject({
      bucket: "legacy-bucket",
      publicUrl: "https://legacy.example/media",
    });
    expect(config.objectStorage.targets.privateBackups.bucket).toBe("legacy-bucket");
  });

  it("gives provider-neutral variables precedence over legacy aliases", () => {
    const config = loadPlatformConfig({
      OBJECT_STORAGE_ENDPOINT: "https://new.example",
      OBJECT_STORAGE_REGION: "new-region",
      OBJECT_STORAGE_ACCESS_KEY_ID: "new-access",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "new-secret",
      OBJECT_STORAGE_BUCKET: "new-bucket",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example",
      S3_ENDPOINT: "https://legacy.example",
      S3_REGION: "legacy-region",
      S3_ACCESS_KEY: "legacy-access",
      S3_SECRET_KEY: "legacy-secret",
      S3_BUCKET: "legacy-bucket",
      S3_PUBLIC_URL: "https://legacy.example/media",
    });

    expect(config.objectStorage).toMatchObject({
      endpoint: "https://new.example",
      region: "new-region",
      accessKeyId: "new-access",
      secretAccessKey: "new-secret",
    });
    expect(config.objectStorage.targets.publicMedia).toMatchObject({
      bucket: "new-bucket",
      publicUrl: "https://cdn.example",
    });
  });

  it("supports isolated logical storage targets", () => {
    const config = loadPlatformConfig({
      OBJECT_STORAGE_MODE: "isolated",
      OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET: "forms",
      OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET: "backups",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://media.example",
    });

    expect(config.objectStorage.targets).toEqual({
      publicMedia: {
        bucket: "media",
        visibility: "public",
        publicUrl: "https://media.example",
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
    });
  });

  it("derives public media URLs from an endpoint when no public URL is set", () => {
    const shared = loadPlatformConfig({
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "media",
    });
    expect(shared.objectStorage.targets.publicMedia.publicUrl).toBe(
      "http://localhost:9000/media",
    );

    const isolated = loadPlatformConfig({
      OBJECT_STORAGE_MODE: "isolated",
      OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET: "forms",
      OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET: "backups",
    });
    expect(isolated.objectStorage.targets.publicMedia.publicUrl).toBe(
      "https://account.r2.cloudflarestorage.com/media",
    );
  });

  it("rejects storage-mode and bucket mismatches", () => {
    expect(() =>
      loadPlatformConfig({
        OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      }),
    ).toThrow("Target-specific buckets require OBJECT_STORAGE_MODE=isolated");

    expect(() =>
      loadPlatformConfig({
        OBJECT_STORAGE_MODE: "isolated",
        OBJECT_STORAGE_BUCKET: "shared",
        OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
        OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET: "forms",
        OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET: "backups",
      }),
    ).toThrow("OBJECT_STORAGE_BUCKET cannot be used with OBJECT_STORAGE_MODE=isolated");
  });

  it("rejects invalid providers, modes, booleans, and incomplete targets", () => {
    expect(() => loadPlatformConfig({ EDGE_PROVIDER: "fast-edge" })).toThrow(
      "EDGE_PROVIDER must be one of none, cloudfront, cloudflare",
    );
    expect(() => loadPlatformConfig({ OBJECT_STORAGE_PROVIDER: "swift" })).toThrow(
      "OBJECT_STORAGE_PROVIDER must be one of s3, minio, r2",
    );
    expect(() => loadPlatformConfig({ OBJECT_STORAGE_MODE: "mixed" })).toThrow(
      "OBJECT_STORAGE_MODE must be one of shared, isolated",
    );
    expect(() => loadPlatformConfig({ CLOUDFLARE_PURGE_ENABLED: "yes" })).toThrow(
      "CLOUDFLARE_PURGE_ENABLED must be either true or false",
    );
    expect(() =>
      loadPlatformConfig({
        OBJECT_STORAGE_MODE: "isolated",
        OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      }),
    ).toThrow("OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET is required");
  });

  it("rejects contradictory or incomplete Cloudflare capability settings", () => {
    expect(() =>
      loadPlatformConfig({
        EDGE_PROVIDER: "cloudfront",
        CLOUDFLARE_PURGE_ENABLED: "true",
        CLOUDFLARE_ZONE_ID: "zone-id",
      }),
    ).toThrow("EDGE_PROVIDER must be cloudflare");

    expect(() =>
      loadPlatformConfig({
        EDGE_PROVIDER: "cloudflare",
        CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED: "true",
      }),
    ).toThrow(
      "CLOUDFLARE_ZONE_ID is required when CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED is true",
    );

    expect(() =>
      loadPlatformConfig({
        EDGE_PROVIDER: "cloudflare",
        CLOUDFLARE_PURGE_ENABLED: "true",
      }),
    ).toThrow("CLOUDFLARE_ZONE_ID is required when CLOUDFLARE_PURGE_ENABLED is true");
  });

  it("requires endpoints for explicitly selected MinIO and R2 providers", () => {
    expect(() => loadPlatformConfig({ OBJECT_STORAGE_PROVIDER: "minio" })).toThrow(
      "OBJECT_STORAGE_ENDPOINT (or S3_ENDPOINT) is required for minio storage",
    );
    expect(() => loadPlatformConfig({ OBJECT_STORAGE_PROVIDER: "r2" })).toThrow(
      "OBJECT_STORAGE_ENDPOINT (or S3_ENDPOINT) is required for r2 storage",
    );
  });

  it("requires explicit R2 credentials and never falls back to MinIO defaults", () => {
    expect(() =>
      loadPlatformConfig({
        OBJECT_STORAGE_PROVIDER: "r2",
        OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      }),
    ).toThrow("OBJECT_STORAGE_ACCESS_KEY_ID (or S3_ACCESS_KEY) is required for r2 storage");

    expect(() =>
      loadPlatformConfig({
        OBJECT_STORAGE_PROVIDER: "r2",
        OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access",
      }),
    ).toThrow("OBJECT_STORAGE_SECRET_ACCESS_KEY (or S3_SECRET_KEY) is required for r2 storage");

    const config = loadPlatformConfig({
      OBJECT_STORAGE_PROVIDER: "r2",
      OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      S3_ACCESS_KEY: "legacy-r2-access",
      S3_SECRET_KEY: "legacy-r2-secret",
    });
    expect(config.objectStorage.accessKeyId).toBe("legacy-r2-access");
    expect(config.objectStorage.secretAccessKey).toBe("legacy-r2-secret");
  });

  it("does not derive an R2 public media URL from the S3 API endpoint", () => {
    const derived = loadPlatformConfig({
      OBJECT_STORAGE_PROVIDER: "r2",
      OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-secret",
    });
    expect(derived.objectStorage.targets.publicMedia.publicUrl).toBeNull();

    const configured = loadPlatformConfig({
      OBJECT_STORAGE_PROVIDER: "r2",
      OBJECT_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-secret",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example",
    });
    expect(configured.objectStorage.targets.publicMedia.publicUrl).toBe("https://cdn.example");
  });

  it("treats whitespace-only environment values as unset", () => {
    const config = loadPlatformConfig({
      EDGE_PROVIDER: "   ",
      S3_BUCKET: "  ",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "\t",
    });

    expect(config.edge.provider).toBe("none");
    expect(config.objectStorage.targets.publicMedia.bucket).toBe("ob-cms-media");
    expect(config.objectStorage.targets.publicMedia.publicUrl).toBe(
      "https://ob-cms-media.s3.amazonaws.com",
    );
  });

  it("never includes secret values in validation errors", () => {
    const secret = "do-not-log-this-secret";

    try {
      loadPlatformConfig({
        EDGE_PROVIDER: secret,
        OBJECT_STORAGE_SECRET_ACCESS_KEY: secret,
        CLOUDFLARE_PURGE_ENABLED: secret,
      });
      throw new Error("expected loadPlatformConfig to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformConfigError);
      expect(String(error)).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain(secret);
    }
  });

  it("does not mutate its input and deeply freezes its output", () => {
    const environment = Object.freeze({ S3_BUCKET: "media" });
    const config = loadPlatformConfig(environment);

    expect(environment).toEqual({ S3_BUCKET: "media" });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.objectStorage)).toBe(true);
    expect(Object.isFrozen(config.objectStorage.targets.publicMedia)).toBe(true);
  });
});
