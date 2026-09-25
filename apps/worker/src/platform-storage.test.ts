import { describe, expect, it } from "bun:test";
import { PlatformConfigError } from "@ob-cms/config/platform-config";
import {
  bucketForTarget,
  loadWorkerObjectStorage,
  loadWorkerPlatformConfig,
  objectStorageClientOptions,
  resolvePublicObjectUrl,
} from "./platform-storage";

describe("worker platform storage config", () => {
  it("preserves legacy S3_* defaults for media and backup targets", () => {
    const platform = loadWorkerPlatformConfig({
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "ob-cms-media",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      S3_PUBLIC_URL: "http://localhost:9000/ob-cms-media",
    });

    expect(platform.edge.provider).toBe("none");
    expect(platform.capabilities.purge.enabled).toBe(false);
    expect(platform.capabilities.customHostnames.enabled).toBe(false);

    const storage = platform.objectStorage;
    expect(storage.mode).toBe("shared");
    expect(storage.endpoint).toBe("http://localhost:9000");
    expect(storage.region).toBe("us-east-1");
    expect(storage.accessKeyId).toBe("minioadmin");
    expect(storage.secretAccessKey).toBe("minioadmin");
    expect(bucketForTarget(storage, "publicMedia")).toBe("ob-cms-media");
    expect(bucketForTarget(storage, "privateBackups")).toBe("ob-cms-media");
    expect(resolvePublicObjectUrl(storage, "sites/a/x.png", "publicMedia")).toBe(
      "http://localhost:9000/ob-cms-media/sites/a/x.png",
    );

    const options = objectStorageClientOptions(storage);
    expect(options.endpoint).toBe("http://localhost:9000");
    expect(options.forcePathStyle).toBe(true);
    expect(options.credentials.accessKeyId).toBe("minioadmin");
  });

  it("prefers explicit OBJECT_STORAGE_* variables over S3_* aliases", () => {
    const storage = loadWorkerObjectStorage({
      OBJECT_STORAGE_PROVIDER: "minio",
      OBJECT_STORAGE_ENDPOINT: "http://minio.internal:9000",
      OBJECT_STORAGE_REGION: "eu-west-1",
      OBJECT_STORAGE_ACCESS_KEY_ID: "neutral-key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "neutral-secret",
      OBJECT_STORAGE_BUCKET: "neutral-media",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example/media",
      S3_ENDPOINT: "http://legacy:9000",
      S3_BUCKET: "legacy-media",
      S3_ACCESS_KEY: "legacy-key",
      S3_SECRET_KEY: "legacy-secret",
      S3_PUBLIC_URL: "https://legacy.example/media",
    });

    expect(storage.provider).toBe("minio");
    expect(storage.endpoint).toBe("http://minio.internal:9000");
    expect(bucketForTarget(storage, "publicMedia")).toBe("neutral-media");
    expect(resolvePublicObjectUrl(storage, "k", "publicMedia")).toBe(
      "https://cdn.example/media/k",
    );
  });

  it("keeps public-media and private-backup buckets isolated in isolated mode", () => {
    const storage = loadWorkerObjectStorage({
      OBJECT_STORAGE_MODE: "isolated",
      OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
      OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET: "forms",
      OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET: "backups",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example/media",
      OBJECT_STORAGE_ACCESS_KEY_ID: "key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret",
    });

    expect(bucketForTarget(storage, "publicMedia")).toBe("media");
    expect(bucketForTarget(storage, "privateBackups")).toBe("backups");
    expect(storage.targets.privateBackups.publicUrl).toBeNull();
    expect(storage.targets.publicMedia.publicUrl).toBe("https://cdn.example/media");
    expect(resolvePublicObjectUrl(storage, "img.png", "publicMedia")).toBe(
      "https://cdn.example/media/img.png",
    );
    expect(() => resolvePublicObjectUrl(storage, "dump.sql", "privateBackups")).toThrow(
      /privateBackups/,
    );
  });

  it("exposes edge capability config without implying network side effects", () => {
    const platform = loadWorkerPlatformConfig({
      EDGE_PROVIDER: "cloudflare",
      CLOUDFLARE_PURGE_ENABLED: "true",
      CLOUDFLARE_ZONE_ID: "zone-123",
      S3_BUCKET: "ob-cms-media",
    });

    expect(platform.edge.provider).toBe("cloudflare");
    expect(platform.capabilities.purge).toEqual({ enabled: true, scopeId: "zone-123" });
    expect(platform.capabilities.customHostnames.enabled).toBe(false);
  });

  it("propagates platform config errors without embedding credential values", () => {
    try {
      loadWorkerObjectStorage({
        OBJECT_STORAGE_PROVIDER: "r2",
        OBJECT_STORAGE_ACCESS_KEY_ID: "AKIA_SECRET_VALUE",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "super-secret-value",
      });
      throw new Error("expected loadWorkerObjectStorage to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformConfigError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("OBJECT_STORAGE_ENDPOINT");
      expect(message).not.toContain("AKIA_SECRET_VALUE");
      expect(message).not.toContain("super-secret-value");
    }
  });
});
