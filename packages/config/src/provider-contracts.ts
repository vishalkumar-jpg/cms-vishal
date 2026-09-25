import type { StorageTargetName } from "./platform-config";

export interface ObjectLocation {
  readonly target: StorageTargetName;
  readonly key: string;
}

export interface ObjectWrite extends ObjectLocation {
  readonly body: Uint8Array;
  readonly contentType?: string;
}

/** Domain-level storage operations; vendor SDK types stay behind adapters. */
export interface ObjectStorage {
  putObject(object: ObjectWrite): Promise<void>;
  deleteObject(location: ObjectLocation): Promise<void>;
  createReadUrl(location: ObjectLocation, expiresInSeconds: number): Promise<string>;
  createWriteUrl(
    location: ObjectLocation,
    expiresInSeconds: number,
    contentType?: string,
  ): Promise<string>;
}

export interface PurgeRequest {
  readonly hostnames: readonly string[];
  readonly paths: readonly string[];
}

/** Purges published content without exposing a CDN-specific request type. */
export interface EdgeCachePurger {
  purge(request: PurgeRequest): Promise<void>;
}

export interface CustomHostnameRequest {
  readonly hostname: string;
  readonly siteId: string;
}

/** Manages a site's edge hostname without exposing provider response types. */
export interface CustomHostnameManager {
  ensureHostname(request: CustomHostnameRequest): Promise<void>;
  removeHostname(request: CustomHostnameRequest): Promise<void>;
}
