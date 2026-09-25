import * as React from "react";
import { Button, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useCreateComment } from "./useComments";
import type { PendingPin } from "../store/collabStore";

/** Inline compose box shown at a freshly-dropped pin until the first body is saved. */
export const CommentPinCompose: React.FC<{
  siteId: string | null;
  pageId: string | null;
  pin: PendingPin;
  anchor: { top: number; left: number };
  onDone: () => void;
}> = ({ siteId, pageId, pin, anchor, onDone }) => {
  const [body, setBody] = React.useState("");
  const create = useCreateComment(siteId, pageId);
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = async (): Promise<void> => {
    const text = body.trim();
    if (!text || !pageId) return;
    try {
      await create.mutateAsync({
        pageId,
        nodeId: pin.nodeId ?? undefined,
        anchorX: pin.nodeId ? undefined : (pin.anchorX ?? undefined),
        anchorY: pin.nodeId ? undefined : (pin.anchorY ?? undefined),
        body: text,
      });
      onDone();
    } catch {
      toast.error("Could not post comment");
    }
  };

  const top = Math.min(anchor.top, window.innerHeight - 180);
  const left = Math.min(anchor.left, window.innerWidth - 300);

  return (
    <div
      className="fixed z-50 w-72 rounded-lg border border-border bg-card p-2 shadow-lg"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <Textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment…"
        rows={3}
        className="mb-2 text-sm"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
          if (e.key === "Escape") onDone();
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={!body.trim() || create.isPending} onClick={() => void submit()}>
          Comment
        </Button>
      </div>
    </div>
  );
};
