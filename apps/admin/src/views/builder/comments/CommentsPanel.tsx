import * as React from "react";
import { useEditor } from "@craftjs/core";
import { MessageSquare, X } from "lucide-react";
import { useSiteStore } from "@/store/siteStore";
import { useCollabStore } from "../store/collabStore";
import { usePageComments } from "./useComments";
import { initials, relTime } from "./commentUtils";
import type { CommentRow } from "./comments.api";

/**
 * Comments panel (drawer). Lists open + resolved threads for the page. Clicking
 * a thread selects/scrolls to its anchored node and opens its popover.
 */
export const CommentsPanel: React.FC<{ pageId: string | null }> = ({ pageId }) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const open = useCollabStore((s) => s.commentsPanelOpen);
  const setOpen = useCollabStore((s) => s.setCommentsPanelOpen);
  const setOpenThreadId = useCollabStore((s) => s.setOpenThreadId);
  const { data: comments } = usePageComments(siteId, pageId);
  const [tab, setTab] = React.useState<"open" | "resolved">("open");

  const { actions, nodeDom } = useEditor((state) => ({ nodeDom: state.nodes }));

  const roots = React.useMemo(
    () => (comments ?? []).filter((c) => c.parentId === null),
    [comments],
  );
  const shown = roots.filter((c) => (tab === "open" ? !c.resolved : c.resolved));
  const replyCount = (rootId: string): number =>
    (comments ?? []).filter((c) => c.parentId === rootId).length;

  if (!open) return null;

  const goTo = (c: CommentRow): void => {
    setOpenThreadId(c.id);
    if (c.nodeId && nodeDom[c.nodeId]?.dom) {
      try {
        actions.selectNode(c.nodeId);
        nodeDom[c.nodeId].dom?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* node gone */
      }
    }
  };

  return (
    <aside className="fixed right-0 top-14 bottom-0 z-40 flex w-80 flex-col border-l border-border bg-card shadow-xl">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4" /> Comments
        </div>
        <button type="button" className="rounded p-1 hover:bg-accent" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex gap-1 border-b border-border px-3 py-2 text-xs">
        {(["open", "resolved"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-2 py-1 font-medium capitalize transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {t} ({roots.filter((c) => (t === "open" ? !c.resolved : c.resolved)).length})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {shown.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            No {tab} comments.
          </p>
        ) : (
          shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => goTo(c)}
              className="mb-1 flex w-full gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {initials(c.authorName, c.authorEmail)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {c.authorName ?? c.authorEmail ?? "Someone"}
                  </span>{" "}
                  · {relTime(c.createdAt)}
                  {c.nodeId ? "" : " · canvas"}
                </p>
                <p className="truncate text-sm">{c.body}</p>
                {replyCount(c.id) > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {replyCount(c.id)} repl{replyCount(c.id) === 1 ? "y" : "ies"}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
