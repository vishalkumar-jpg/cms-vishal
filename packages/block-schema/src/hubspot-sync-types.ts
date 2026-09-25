/** Sync metadata types shared by the HubSpot API client and migration layers. */
export type HubspotSyncMode = "AUTO" | "FROZEN" | "CONFLICT";

export interface HubspotPageSyncMeta {
  syncMode: HubspotSyncMode;
  /** SHA-256 hex of normalized HubSpot body + SEO fields last applied to OB. */
  contentHash: string;
  /** Hash of embed HTML last written by sync/import (detect OB edits). */
  embedHtmlHash: string;
  lastSyncedAt?: string;
  lastConflictAt?: string;
  lastConflictMessage?: string;
}
