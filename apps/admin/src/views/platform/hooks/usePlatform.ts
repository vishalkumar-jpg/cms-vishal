import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@ob-cms/shared";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useAuthStore } from "@/store/authStore";
import {
  platformActivateSiteRequest,
  platformCreateSiteRequest,
  platformOverviewRequest,
  platformSitesRequest,
  platformSuspendSiteRequest,
  platformUsersRequest,
  platformBackupsRequest,
  platformCreateBackupRequest,
  platformRestoreBackupRequest,
  platformDeleteBackupRequest,
  type PlatformCreateSitePayload,
  type PlatformOverview,
  type PlatformSite,
  type PlatformUser,
  type PlatformBackup,
} from "../api/platform.api";

/** Only platform admins may load any of these. */
const usePlatformEnabled = (): boolean =>
  useAuthStore((s) => Boolean(s.user?.isPlatformAdmin));

export const usePlatformOverview = () => {
  const enabled = usePlatformEnabled();
  return useQuery<PlatformOverview>({
    queryKey: [ADMIN_QUERY_KEYS.PLATFORM_OVERVIEW],
    queryFn: () => platformOverviewRequest(),
    enabled,
  });
};

export const usePlatformSites = () => {
  const enabled = usePlatformEnabled();
  return useQuery<PlatformSite[]>({
    queryKey: [ADMIN_QUERY_KEYS.PLATFORM_SITES],
    queryFn: () => platformSitesRequest(),
    enabled,
  });
};

export const usePlatformUsers = () => {
  const enabled = usePlatformEnabled();
  return useQuery<PlatformUser[]>({
    queryKey: [ADMIN_QUERY_KEYS.PLATFORM_USERS],
    queryFn: () => platformUsersRequest(),
    enabled,
  });
};

/** Invalidate everything that changes when a tenant is created/toggled. */
const useInvalidatePlatform = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PLATFORM_SITES] });
    qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PLATFORM_OVERVIEW] });
    // The new/changed tenant must also appear in the normal SiteSwitcher.
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.SITES] });
  };
};

export const usePlatformCreateSite = () => {
  const invalidate = useInvalidatePlatform();
  return useMutation<PlatformSite, unknown, PlatformCreateSitePayload>({
    mutationFn: (payload) => platformCreateSiteRequest(payload),
    onSuccess: () => invalidate(),
  });
};

export const usePlatformSuspendSite = () => {
  const invalidate = useInvalidatePlatform();
  return useMutation<PlatformSite, unknown, string>({
    mutationFn: (id) => platformSuspendSiteRequest(id),
    onSuccess: () => invalidate(),
  });
};

export const usePlatformActivateSite = () => {
  const invalidate = useInvalidatePlatform();
  return useMutation<PlatformSite, unknown, string>({
    mutationFn: (id) => platformActivateSiteRequest(id),
    onSuccess: () => invalidate(),
  });
};

// --- E26 — platform database backups ----------------------------------------

/**
 * Backups list. Polls every 5s while any backup is still in flight
 * (pending/running) so the worker's status transition shows up without a manual
 * refresh; stops polling once everything has settled.
 */
export const usePlatformBackups = () => {
  const enabled = usePlatformEnabled();
  return useQuery<PlatformBackup[]>({
    queryKey: [ADMIN_QUERY_KEYS.PLATFORM_BACKUPS],
    queryFn: () => platformBackupsRequest(),
    enabled,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((b) => b.status === "pending" || b.status === "running")
        ? 5000
        : false,
  });
};

const useInvalidateBackups = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.PLATFORM_BACKUPS] });
};

export const usePlatformCreateBackup = () => {
  const invalidate = useInvalidateBackups();
  return useMutation<PlatformBackup, unknown, void>({
    mutationFn: () => platformCreateBackupRequest(),
    onSuccess: () => invalidate(),
  });
};

export const usePlatformRestoreBackup = () => {
  const invalidate = useInvalidateBackups();
  return useMutation<{ enqueued: true; backupId: string }, unknown, string>({
    mutationFn: (id) => platformRestoreBackupRequest(id),
    onSuccess: () => invalidate(),
  });
};

export const usePlatformDeleteBackup = () => {
  const invalidate = useInvalidateBackups();
  return useMutation<{ deleted: true }, unknown, string>({
    mutationFn: (id) => platformDeleteBackupRequest(id),
    onSuccess: () => invalidate(),
  });
};
