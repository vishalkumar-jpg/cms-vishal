export type EdgeProvider = "none" | "cloudfront" | "cloudflare";
export type ObjectStorageProvider = "s3" | "minio" | "r2";
export type ObjectStorageMode = "shared" | "isolated";
export type StorageTargetName = "publicMedia" | "privateFormAttachments" | "privateBackups";

export type PlatformEnvironment = Readonly<Record<string, string | undefined>>;

export interface CapabilityConfig {
  readonly enabled: boolean;
  /** Provider-specific scope normalized to a neutral identifier. */
  readonly scopeId: string | null;
}

export interface StorageTargetConfig {
  readonly bucket: string;
  readonly visibility: "public" | "private";
  readonly publicUrl: string | null;
}

export interface PlatformConfig {
  readonly edge: {
    readonly provider: EdgeProvider;
  };
  readonly capabilities: {
    readonly purge: CapabilityConfig;
    readonly customHostnames: CapabilityConfig;
  };
  readonly objectStorage: {
    readonly provider: ObjectStorageProvider;
    readonly mode: ObjectStorageMode;
    readonly endpoint: string | null;
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly targets: Readonly<Record<StorageTargetName, StorageTargetConfig>>;
  };
}

export interface PlatformConfigIssue {
  readonly variables: readonly string[];
  readonly message: string;
}

export class PlatformConfigError extends Error {
  readonly issues: readonly PlatformConfigIssue[];

  constructor(issues: readonly PlatformConfigIssue[]) {
    super(`Invalid platform configuration:\n${issues.map((issue) => `- ${issue.message}`).join("\n")}`);
    this.name = "PlatformConfigError";
    this.issues = Object.freeze(
      issues.map((issue) =>
        Object.freeze({
          variables: Object.freeze([...issue.variables]),
          message: issue.message,
        }),
      ),
    );
  }
}

const EDGE_PROVIDERS = ["none", "cloudfront", "cloudflare"] as const;
const STORAGE_PROVIDERS = ["s3", "minio", "r2"] as const;
const STORAGE_MODES = ["shared", "isolated"] as const;

/**
 * Purely translates an environment-shaped object into immutable platform
 * configuration. It reads no process globals and performs no I/O.
 */
export function loadPlatformConfig(environment: PlatformEnvironment): PlatformConfig {
  const issues: PlatformConfigIssue[] = [];
  const edgeProvider = readEnum(environment, "EDGE_PROVIDER", EDGE_PROVIDERS, "none", issues);
  const storageProvider = readEnum(
    environment,
    "OBJECT_STORAGE_PROVIDER",
    STORAGE_PROVIDERS,
    "s3",
    issues,
  );
  const storageMode = readEnum(
    environment,
    "OBJECT_STORAGE_MODE",
    STORAGE_MODES,
    "shared",
    issues,
  );

  const purgeEnabled = readBoolean(environment, "CLOUDFLARE_PURGE_ENABLED", false, issues);
  const customHostnamesEnabled = readBoolean(
    environment,
    "CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED",
    false,
    issues,
  );
  const cloudflareZoneId = readOptional(environment, "CLOUDFLARE_ZONE_ID");

  if ((purgeEnabled || customHostnamesEnabled) && edgeProvider !== "cloudflare") {
    issues.push({
      variables: [
        "EDGE_PROVIDER",
        ...(purgeEnabled ? ["CLOUDFLARE_PURGE_ENABLED"] : []),
        ...(customHostnamesEnabled ? ["CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED"] : []),
      ],
      message:
        "EDGE_PROVIDER must be cloudflare when a Cloudflare capability is enabled",
    });
  }

  if (purgeEnabled && cloudflareZoneId === null) {
    issues.push({
      variables: ["CLOUDFLARE_PURGE_ENABLED", "CLOUDFLARE_ZONE_ID"],
      message: "CLOUDFLARE_ZONE_ID is required when CLOUDFLARE_PURGE_ENABLED is true",
    });
  }

  if (customHostnamesEnabled && cloudflareZoneId === null) {
    issues.push({
      variables: ["CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED", "CLOUDFLARE_ZONE_ID"],
      message:
        "CLOUDFLARE_ZONE_ID is required when CLOUDFLARE_CUSTOM_HOSTNAMES_ENABLED is true",
    });
  }

  const endpoint = readWithLegacy(environment, "OBJECT_STORAGE_ENDPOINT", "S3_ENDPOINT");
  if ((storageProvider === "minio" || storageProvider === "r2") && endpoint === null) {
    issues.push({
      variables: ["OBJECT_STORAGE_PROVIDER", "OBJECT_STORAGE_ENDPOINT", "S3_ENDPOINT"],
      message: `OBJECT_STORAGE_ENDPOINT (or S3_ENDPOINT) is required for ${storageProvider} storage`,
    });
  }

  const region =
    readWithLegacy(environment, "OBJECT_STORAGE_REGION", "S3_REGION") ??
    (storageProvider === "r2" ? "auto" : "us-east-1");
  const accessKeyId = readWithLegacy(
    environment,
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "S3_ACCESS_KEY",
  );
  const secretAccessKey = readWithLegacy(
    environment,
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    "S3_SECRET_KEY",
  );
  // R2 has no MinIO-style default identity; require explicit credentials.
  if (storageProvider === "r2" && accessKeyId === null) {
    issues.push({
      variables: ["OBJECT_STORAGE_ACCESS_KEY_ID", "S3_ACCESS_KEY"],
      message: "OBJECT_STORAGE_ACCESS_KEY_ID (or S3_ACCESS_KEY) is required for r2 storage",
    });
  }
  if (storageProvider === "r2" && secretAccessKey === null) {
    issues.push({
      variables: ["OBJECT_STORAGE_SECRET_ACCESS_KEY", "S3_SECRET_KEY"],
      message: "OBJECT_STORAGE_SECRET_ACCESS_KEY (or S3_SECRET_KEY) is required for r2 storage",
    });
  }
  const publicUrl = readWithLegacy(
    environment,
    "OBJECT_STORAGE_PUBLIC_MEDIA_URL",
    "S3_PUBLIC_URL",
  );

  const targets =
    storageMode === "isolated"
      ? loadIsolatedTargets(environment, storageProvider, endpoint, publicUrl, issues)
      : loadSharedTargets(environment, storageProvider, endpoint, publicUrl, issues);

  if (issues.length > 0) {
    throw new PlatformConfigError(issues);
  }

  return deepFreeze({
    edge: { provider: edgeProvider },
    capabilities: {
      purge: { enabled: purgeEnabled, scopeId: purgeEnabled ? cloudflareZoneId : null },
      customHostnames: {
        enabled: customHostnamesEnabled,
        scopeId: customHostnamesEnabled ? cloudflareZoneId : null,
      },
    },
    objectStorage: {
      provider: storageProvider,
      mode: storageMode,
      endpoint,
      region,
      accessKeyId: accessKeyId ?? "minioadmin",
      secretAccessKey: secretAccessKey ?? "minioadmin",
      targets,
    },
  });
}

function loadSharedTargets(
  environment: PlatformEnvironment,
  provider: ObjectStorageProvider,
  endpoint: string | null,
  configuredPublicUrl: string | null,
  issues: PlatformConfigIssue[],
): Record<StorageTargetName, StorageTargetConfig> {
  const isolatedVariables = [
    "OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET",
    "OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET",
    "OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET",
  ].filter((variable) => readOptional(environment, variable) !== null);

  if (isolatedVariables.length > 0) {
    issues.push({
      variables: ["OBJECT_STORAGE_MODE", ...isolatedVariables],
      message: "Target-specific buckets require OBJECT_STORAGE_MODE=isolated",
    });
  }

  const bucket =
    readWithLegacy(environment, "OBJECT_STORAGE_BUCKET", "S3_BUCKET") ?? "ob-cms-media";
  const publicUrl = derivePublicMediaUrl(
    provider,
    endpoint,
    bucket,
    configuredPublicUrl,
    `https://${bucket}.s3.amazonaws.com`,
  );

  return {
    publicMedia: {
      bucket,
      visibility: "public",
      publicUrl,
    },
    privateFormAttachments: {
      bucket,
      visibility: "private",
      publicUrl: null,
    },
    privateBackups: {
      bucket,
      visibility: "private",
      publicUrl: null,
    },
  };
}

function loadIsolatedTargets(
  environment: PlatformEnvironment,
  provider: ObjectStorageProvider,
  endpoint: string | null,
  configuredPublicUrl: string | null,
  issues: PlatformConfigIssue[],
): Record<StorageTargetName, StorageTargetConfig> {
  if (readOptional(environment, "OBJECT_STORAGE_BUCKET") !== null) {
    issues.push({
      variables: ["OBJECT_STORAGE_MODE", "OBJECT_STORAGE_BUCKET"],
      message: "OBJECT_STORAGE_BUCKET cannot be used with OBJECT_STORAGE_MODE=isolated",
    });
  }

  const publicMediaBucket = requireValue(
    environment,
    "OBJECT_STORAGE_PUBLIC_MEDIA_BUCKET",
    issues,
  );
  const formAttachmentsBucket = requireValue(
    environment,
    "OBJECT_STORAGE_PRIVATE_FORM_ATTACHMENTS_BUCKET",
    issues,
  );
  const backupsBucket = requireValue(
    environment,
    "OBJECT_STORAGE_PRIVATE_BACKUPS_BUCKET",
    issues,
  );
  const publicUrl = derivePublicMediaUrl(
    provider,
    publicMediaBucket ? endpoint : null,
    publicMediaBucket,
    configuredPublicUrl,
    null,
  );

  return {
    publicMedia: {
      bucket: publicMediaBucket,
      visibility: "public",
      publicUrl,
    },
    privateFormAttachments: {
      bucket: formAttachmentsBucket,
      visibility: "private",
      publicUrl: null,
    },
    privateBackups: {
      bucket: backupsBucket,
      visibility: "private",
      publicUrl: null,
    },
  };
}

function readOptional(environment: PlatformEnvironment, variable: string): string | null {
  const value = environment[variable];
  // Treat undefined and blank (whitespace-only) values as unset.
  return value === undefined || value.trim() === "" ? null : value;
}

/**
 * Resolves the public base URL for the public-media target. An explicit
 * configured URL always wins. R2's S3 API endpoint is not a public media host,
 * so it is never used to derive a public URL; AWS/MinIO and other
 * S3-compatible providers keep deriving `${endpoint}/${bucket}`.
 */
function derivePublicMediaUrl(
  provider: ObjectStorageProvider,
  endpoint: string | null,
  bucket: string,
  configuredPublicUrl: string | null,
  endpointlessFallback: string | null,
): string | null {
  if (configuredPublicUrl !== null) return configuredPublicUrl;
  if (provider === "r2") return null;
  if (endpoint !== null) return `${endpoint}/${bucket}`;
  return endpointlessFallback;
}

function readWithLegacy(
  environment: PlatformEnvironment,
  variable: string,
  legacyVariable: string,
): string | null {
  return readOptional(environment, variable) ?? readOptional(environment, legacyVariable);
}

function requireValue(
  environment: PlatformEnvironment,
  variable: string,
  issues: PlatformConfigIssue[],
): string {
  const value = readOptional(environment, variable);
  if (value !== null) return value;

  issues.push({
    variables: [variable],
    message: `${variable} is required when OBJECT_STORAGE_MODE is isolated`,
  });
  return "";
}

function readBoolean(
  environment: PlatformEnvironment,
  variable: string,
  fallback: boolean,
  issues: PlatformConfigIssue[],
): boolean {
  const value = readOptional(environment, variable);
  if (value === null) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;

  issues.push({
    variables: [variable],
    message: `${variable} must be either true or false`,
  });
  return fallback;
}

function readEnum<const Values extends readonly string[]>(
  environment: PlatformEnvironment,
  variable: string,
  values: Values,
  fallback: Values[number],
  issues: PlatformConfigIssue[],
): Values[number] {
  const value = readOptional(environment, variable);
  if (value === null) return fallback;
  if ((values as readonly string[]).includes(value)) return value as Values[number];

  issues.push({
    variables: [variable],
    message: `${variable} must be one of ${values.join(", ")}`,
  });
  return fallback;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}
