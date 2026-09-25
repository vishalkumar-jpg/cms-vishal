import { request } from "@/services/AxiosService";

/** A notification as returned by the API (enriched with the actor's display info). */
export interface NotificationRow {
  id: string;
  siteId: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  link: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationRow[];
  unreadCount: number;
}

/** My recent notifications + my unread count. Site is resolved from X-Site-Id. */
export const listNotificationsRequest = (unread?: boolean): Promise<NotificationList> =>
  request<NotificationList>({
    url: "/notifications",
    method: "GET",
    params: unread ? { unread: "true" } : undefined,
  });

export const markNotificationReadRequest = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: `/notifications/${id}/read`, method: "POST" });

export const markAllNotificationsReadRequest = (): Promise<{ ok: true }> =>
  request<{ ok: true }>({ url: "/notifications/read-all", method: "POST" });
