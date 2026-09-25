import * as React from "react";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { usePage, useSchedulePage, useUpdatePage } from "@/views/pages/hooks/usePages";

/** Convert an ISO string to the value a <input type="datetime-local"> expects. */
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};

/**
 * Schedule a page to publish at a future time (POST /pages/:id/schedule) AND set
 * a CONTENT-OPS expiry (auto-unpublish) via PATCH /pages/:id { expiresAt }.
 */
export const ScheduleDialog: React.FC<{
  siteId: string | null;
  pageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ siteId, pageId, open, onOpenChange }) => {
  const [when, setWhen] = React.useState("");
  const [expires, setExpires] = React.useState("");
  const schedule = useSchedulePage(siteId);
  const update = useUpdatePage(siteId);
  const { data: page } = usePage(siteId, open ? pageId : null);

  // Seed the expiry field from the page when the dialog opens.
  React.useEffect(() => {
    if (open) setExpires(toLocalInput(page?.expiresAt ?? null));
  }, [open, page?.expiresAt]);

  const onSubmit = (): void => {
    if (!pageId || !when) return;
    const iso = new Date(when).toISOString();
    schedule.mutate(
      { pageId, payload: { scheduledAt: iso } },
      {
        onSuccess: () => {
          toast.success("Page scheduled");
          onOpenChange(false);
        },
        onError: () => toast.error("Schedule failed"),
      },
    );
  };

  const onSaveExpiry = (): void => {
    if (!pageId) return;
    const iso = expires ? new Date(expires).toISOString() : null;
    update.mutate(
      { pageId, payload: { expiresAt: iso } },
      {
        onSuccess: () => toast.success(iso ? "Expiry set" : "Expiry cleared"),
        onError: () => toast.error("Could not update expiry"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule publish</DialogTitle>
          <DialogDescription>Pick when this page should go live.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-at">Publish at</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>
        {/* CONTENT-OPS — expiry (auto-unpublish). Independent of scheduling: it
            applies to the currently-published page and clears on manual publish. */}
        <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
          <Label htmlFor="expires-at">Expires (auto-unpublish)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="expires-at"
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveExpiry}
              disabled={update.isPending}
            >
              Save
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            When set, the page is automatically unpublished after this time. Leave empty to
            never expire. Cleared on the next manual publish.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!when || schedule.isPending}>
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
