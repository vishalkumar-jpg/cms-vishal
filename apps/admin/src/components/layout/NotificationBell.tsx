import * as React from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/views/notifications/useNotifications";
import type { NotificationRow } from "@/views/notifications/notifications.api";

/** Relative "time ago" for the notification timestamp (no dep needed). */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/**
 * Header notification bell. Shows the current user's unread count as a badge and
 * opens a dropdown of recent notifications. Clicking an item marks it read and
 * navigates to the linked entity (page / comment). Polls every 30s + refetches
 * on focus (see useNotifications). Current-user + active-site scoped server-side.
 */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [open, setOpen] = React.useState(false);

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  const onItemClick = (n: NotificationRow): void => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onItemClick(n)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent",
                  !n.readAt && "bg-primary/5",
                )}
              >
                <div className="flex items-center gap-2">
                  {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
                {n.body && (
                  <span className="line-clamp-2 pl-4 text-xs text-muted-foreground">{n.body}</span>
                )}
                {(n.actorName || n.actorEmail) && (
                  <span className="pl-4 text-[11px] text-muted-foreground/70">
                    {n.actorName ?? n.actorEmail}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
