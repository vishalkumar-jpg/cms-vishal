import * as React from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "./useNotifications";
import type { NotificationRow } from "./notifications.api";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * Full notifications page (the bell's list, expanded). Current-user + active-site
 * scoped server-side. Clicking an item marks it read and navigates to the entity.
 */
export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  const onClick = (n: NotificationRow): void => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Notifications</h1>
          {unread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {unread} unread
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0 bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </div>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onClick(n)}
              className={cn(
                "flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent",
                !n.readAt && "bg-primary/5",
              )}
            >
              <div className="flex items-center gap-2">
                {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <span className="flex-1 text-sm font-medium">{n.title}</span>
                <span className="text-xs text-muted-foreground">{formatWhen(n.createdAt)}</span>
              </div>
              {n.body && <p className="pl-4 text-sm text-muted-foreground">{n.body}</p>}
              {(n.actorName || n.actorEmail) && (
                <p className="pl-4 text-xs text-muted-foreground/70">
                  by {n.actorName ?? n.actorEmail}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
