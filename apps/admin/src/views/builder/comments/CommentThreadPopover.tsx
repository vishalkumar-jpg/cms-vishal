import * as React from "react";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import {
  useDeleteComment,
  usePageComments,
  useReplyComment,
  useResolveComment,
} from "./useComments";
import { initials, relTime } from "./commentUtils";
import type { CommentRow } from "./comments.api";

/** The thread popover: root body + replies + a reply box + resolve/delete. */
export const CommentThreadPopover: React.FC<{
  rootId: string;
  siteId: string | null;
  pageId: string | null;
  anchor: { top: number; left: number } | null;
  onClose: () => void;
  onSelectNode: (nodeId: string | null) => void;
}> = ({ rootId, siteId, pageId, anchor, onClose, onSelectNode }) => {
  const { data: comments } = usePageComments(siteId, pageId);
  const reply = useReplyComment(siteId, pageId);
  const resolve = useResolveComment(siteId, pageId);
  const del = useDeleteComment(siteId, pageId);
  const confirm = useConfirm();
  const [text, setText] = React.useState("");

  const root = comments?.find((c) => c.id === rootId) ?? null;
  const replies = React.useMemo(
    () => (comments ?? []).filter((c) => c.parentId === rootId),
    [comments, rootId],
  );

  React.useEffect(() => {
    if (root?.nodeId) onSelectNode(root.nodeId);
  }, [rootId]);

  if (!root || !anchor) return null;

  const top = Math.min(anchor.top, window.innerHeight - 320);
  const left = Math.min(anchor.left + 18, window.innerWidth - 320);

  const submitReply = async (): Promise<void> => {
    const b = text.trim();
    if (!b) return;
    try {
      await reply.mutateAsync({ rootId, body: b });
      setText("");
    } catch {
      toast.error("Could not post reply");
    }
  };

  return (
    <div
      className="fixed z-50 flex max-h-[22rem] w-80 flex-col rounded-lg border border-border bg-card shadow-xl"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {root.resolved ? "Resolved thread" : "Comment thread"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={root.resolved ? "Reopen" : "Resolve"}
            className="rounded p-1 hover:bg-accent"
            onClick={() =>
              resolve.mutate({ rootId, resolved: !root.resolved })
            }
          >
            {root.resolved ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </button>
          <button
            type="button"
            title="Delete thread"
            className="rounded p-1 hover:bg-accent"
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: "Delete this comment thread?",
                  description: "All replies in this thread will be permanently removed.",
                  confirmLabel: DELETE_CONFIRM_LABEL,
                  destructive: true,
                });
                if (!ok) return;
                del.mutate(rootId);
                onClose();
              })();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
          <button type="button" title="Close" className="rounded p-1 hover:bg-accent" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
        <CommentBubble c={root} />
        {replies.map((r) => (
          <CommentBubble key={r.id} c={r} />
        ))}
      </div>

      {!root.resolved && (
        <div className="border-t border-border p-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply…"
            rows={2}
            className="mb-2 text-sm"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submitReply();
            }}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!text.trim() || reply.isPending}
              onClick={() => void submitReply()}
            >
              Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const CommentBubble: React.FC<{ c: CommentRow }> = ({ c }) => (
  <div className="flex gap-2">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
      {initials(c.authorName, c.authorEmail)}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          {c.authorName ?? c.authorEmail ?? "Someone"}
        </span>{" "}
        · {relTime(c.createdAt)}
      </p>
      <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
    </div>
  </div>
);
