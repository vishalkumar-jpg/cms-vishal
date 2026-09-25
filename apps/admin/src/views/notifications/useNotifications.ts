import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import {
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  type NotificationList,
} from "./notifications.api";

/**
 * Wrapped notification hooks (current-user + active-site scoped). The bell polls
 * every 30s and refetches on window focus so the unread badge stays fresh.
 */
export const useNotifications = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<NotificationList>({
    queryKey: [ADMIN_QUERY_KEYS.NOTIFICATIONS, siteId],
    queryFn: () => listNotificationsRequest(),
    enabled: !!siteId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, string>({
    mutationFn: (id) => markNotificationReadRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.NOTIFICATIONS, siteId] }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<{ ok: true }, unknown, void>({
    mutationFn: () => markAllNotificationsReadRequest(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.NOTIFICATIONS, siteId] }),
  });
};
