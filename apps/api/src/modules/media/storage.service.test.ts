import { describe, expect, it } from "bun:test";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PlatformConfigError } from "@ob-cms/config/platform-config";
import {
  canResolvePublicObjectUrl,
  createS3Client,
  loadObjectStorage,
  resolvePublicObjectUrl,
} from "./storage.service";

describe("StorageService platform config adoption", () => {
  it("preserves legacy S3_* defaults when provider-neutral vars are absent", () => {
    const storage = loadObjectStorage({
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "ob-cms-media",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      S3_PUBLIC_URL: "http://localhost:9000/ob-cms-media",
    });

    expect(storage.provider).toBe("s3");
    expect(storage.mode).toBe("shared");
    expect(storage.endpoint).toBe("http://localhost:9000");
    expect(storage.region).toBe("us-east-1");
    expect(storage.accessKeyId).toBe("minioadmin");
    expect(storage.secretAccessKey).toBe("minioadmin");
    expect(storage.targets.publicMedia).toEqual({
      bucket: "ob-cms-media",
      visibility: "public",
      publicUrl: "http://localhost:9000/ob-cms-media",
    });
    expect(storage.targets.privateFormAttachments.bucket).toBe("ob-cms-media");
    expect(storage.targets.privateFormAttachments.publicUrl).toBeNull();
    expect(storage.targets.privateBackups.bucket).toBe("ob-cms-media");
    expect(storage.targets.privateBackups.publicUrl).toBeNull();

    expect(resolvePublicObjectUrl(storage, "sites/a/file.png")).toBe(
      "http://localhost:9000/ob-cms-media/sites/a/file.png",
    );
    // Shared mode keeps legacy single-bucket URL behavior for private targets.
    expect(canResolvePublicObjectUrl(storage, "privateFormAttachments")).toBe(true);
    expect(
      resolvePublicObjectUrl(storage, "sites/a/form-uploads/x.pdf", "privateFormAttachments"),
    ).toBe("http://localhost:9000/ob-cms-media/sites/a/form-uploads/x.pdf");
    expect(resolvePublicObjectUrl(storage, "backups/dump.sql", "privateBackups")).toBe(
      "http://localhost:9000/ob-cms-media/backups/dump.sql",
    );

    const client = createS3Client(storage);
    expect(client.config.forcePathStyle).toBe(true);
  });

  it("prefers provider-neutral OBJECT_STORAGE_* variables over S3_* aliases", () => {
    const storage = loadObjectStorage({
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
    });

    expect(storage.provider).toBe("minio");
    expect(storage.endpoint).toBe("http://minio.internal:9000");
    expect(storage.region).toBe("eu-west-1");
    expect(storage.accessKeyId).toBe("neutral-key");
    expect(storage.secretAccessKey).toBe("neutral-secret");
    expect(storage.targets.publicMedia.bucket).toBe("neutral-media");
    expect(resolvePublicObjectUrl(storage, "k")).toBe("https://cdn.example/media/k");
  });

  it("derives the legacy public media URL from endpoint + bucket when unset", () => {
    const storage = loadObjectStorage({
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "media",
    });
    expect(resolvePublicObjectUrl(storage, "a/b")).toBe("http://localhost:9000/media/a/b");
  });

  it("derives the AWS-style public URL when no endpoint or public URL is set", () => {
    const storage = loadObjectStorage({
      S3_BUCKET: "prod-media",
      S3_REGION: "us-west-2",
    });
    expect(storage.endpoint).toBeNull();
    expect(resolvePublicObjectUrl(storage, "key")).toBe(
      "https://prod-media.s3.amazonaws.com/key",
    );
    expect(createS3Client(storage).config.forcePathStyle).toBe(false);
  });

  it("keeps public media and private targets on isolated buckets without shared public URLs", () => {
    const storage = loadObjectStorage({
      OBJECT_STORAGE_MODE: "isolated",
      OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
      OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET: "forms",
      OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET: "backups",
      OBJECT_STORAGE_PUBLIC_MEDIA_URL: "https://cdn.example/media",
      OBJECT_STORAGE_ACCESS_KEY_ID: "key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret",
    });

    // Presign/delete callers select these buckets by StorageTargetName.
    expect(storage.targets.publicMedia.bucket).toBe("media");
    expect(storage.targets.privateFormAttachments.bucket).toBe("forms");
    expect(storage.targets.privateBackups.bucket).toBe("backups");
    expect(canResolvePublicObjectUrl(storage, "publicMedia")).toBe(true);
    expect(canResolvePublicObjectUrl(storage, "privateFormAttachments")).toBe(false);
    expect(canResolvePublicObjectUrl(storage, "privateBackups")).toBe(false);
    expect(resolvePublicObjectUrl(storage, "img.png", "publicMedia")).toBe(
      "https://cdn.example/media/img.png",
    );
    expect(() =>
      resolvePublicObjectUrl(storage, "upload.pdf", "privateFormAttachments"),
    ).toThrow(/privateFormAttachments/);
    expect(() => resolvePublicObjectUrl(storage, "dump.sql", "privateBackups")).toThrow(
      /privateBackups/,
    );
  });

  it("presigns GET downloads against the private target bucket", async () => {
    const storage = loadObjectStorage({
      OBJECT_STORAGE_MODE: "isolated",
      OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
      OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET: "media",
      OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET: "forms",
      OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET: "backups",
      OBJECT_STORAGE_ACCESS_KEY_ID: "key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret",
    });
    const client = createS3Client(storage);
    const bucket = storage.targets.privateBackups.bucket;
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: "backups/dump.sql",
      }),
      { expiresIn: 900 },
    );
    const parsedUrl = new URL(url);
    expect(
      parsedUrl.hostname.startsWith(`${bucket}.`) ||
        parsedUrl.pathname.startsWith(`/${bucket}/`),
    ).toBe(true);
    expect(url).toContain("X-Amz-Signature");
    expect(url).toContain("backups/dump.sql");
  });

  it("propagates platform config errors without embedding credential values", () => {
    try {
      loadObjectStorage({
        OBJECT_STORAGE_PROVIDER: "r2",
        OBJECT_STORAGE_ACCESS_KEY_ID: "AKIA_SECRET_VALUE",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "super-secret-value",
      });
      throw new Error("expected loadObjectStorage to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformConfigError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("OBJECT_STORAGE_ENDPOINT");
      expect(message).not.toContain("AKIA_SECRET_VALUE");
      expect(message).not.toContain("super-secret-value");
    }
  });
});
