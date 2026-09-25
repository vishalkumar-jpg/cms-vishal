import { request } from "@/services/AxiosService";

/**
 * Platform-admin console API client. These routes are CROSS-TENANT and carry NO
 * `X-Site-Id` header — the API's PlatformAdminGuard authorizes them by the
 * caller's `isPlatformAdmin` flag.
 */

export interface PlatformOverview {
  sites: number;
  users: number;
  pages: number;
  publishedPages: number;
  forms: number;
  submissions: number;
  domains: number;
}

export interface PlatformSiteCounts {
  pages: number;
  publishedPages: number;
  members: number;
  forms: number;
  domains: number;
}

export interface PlatformSite {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  primaryDomain: string | null;
  customDomain: string | null;
  status: string;
  visibility: string;
  createdAt: string;
  counts: PlatformSiteCounts;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  status: string;
  createdAt: string;
}

export interface PlatformCreateSitePayload {
  name: string;
  subdomain: string;
  slug?: string;
}

export const platformOverviewRequest = (): Promise<PlatformOverview> =>
  request<PlatformOverview>({ url: "/platform/overview", method: "GET" });

export const platformSitesRequest = (): Promise<PlatformSite[]> =>
  request<PlatformSite[]>({ url: "/platform/sites", method: "GET" });

export const platformUsersRequest = (): Promise<PlatformUser[]> =>
  request<PlatformUser[]>({ url: "/platform/users", method: "GET" });

export const platformCreateSiteRequest = (
  payload: PlatformCreateSitePayload,
): Promise<PlatformSite> =>
  request<PlatformSite>({ url: "/platform/sites", method: "POST", data: payload });

export const platformSuspendSiteRequest = (id: string): Promise<PlatformSite> =>
  request<PlatformSite>({ url: `/platform/sites/${id}/suspend`, method: "POST" });

export const platformActivateSiteRequest = (id: string): Promise<PlatformSite> =>
  request<PlatformSite>({ url: `/platform/sites/${id}/activate`, method: "POST" });

// --- E26 — platform database backups ----------------------------------------

export interface PlatformBackup {
  id: string;
  filename: string;
  sizeBytes: number | null;
  status: "pending" | "running" | "completed" | "failed";
  kind: "manual" | "scheduled";
  storageKey: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export const platformBackupsRequest = (): Promise<PlatformBackup[]> =>
  request<PlatformBackup[]>({ url: "/platform/backups", method: "GET" });

export const platformCreateBackupRequest = (): Promise<PlatformBackup> =>
  request<PlatformBackup>({ url: "/platform/backups", method: "POST" });

export const platformRestoreBackupRequest = (
  id: string,
): Promise<{ enqueued: true; backupId: string }> =>
  request({ url: `/platform/backups/${id}/restore`, method: "POST", data: { confirm: true } });

export const platformDeleteBackupRequest = (id: string): Promise<{ deleted: true }> =>
  request({ url: `/platform/backups/${id}`, method: "DELETE" });

export const platformBackupDownloadRequest = (
  id: string,
): Promise<{ url: string; filename: string }> =>
  request({ url: `/platform/backups/${id}/download`, method: "GET" });
