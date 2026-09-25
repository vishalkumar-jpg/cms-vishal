import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { useCreateWebhook, useUpdateWebhook } from "../hooks/useDevelopers";
import { WEBHOOK_EVENTS, type Webhook } from "../types";
import { CopyField } from "./CopyField";

/**
 * Create / edit a webhook subscription. On create the generated signing secret
 * is revealed ONCE (so the subscriber can configure HMAC verification).
 */
export const WebhookDialog: React.FC<{
  webhook: Webhook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ webhook, open, onOpenChange }) => {
  const isEdit = webhook !== null;
  const create = useCreateWebhook();
  const update = useUpdateWebhook();

  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>([]);
  const [active, setActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setUrl(webhook?.url ?? "");
    setEvents(webhook?.events ?? []);
    setActive(webhook?.active ?? true);
    setError(null);
    setRevealedSecret(null);
  }, [open, webhook]);

  const toggleEvent = (ev: string): void => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const isPending = create.isPending || update.isPending;

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      setError("URL must be an http(s) URL.");
      return;
    }
    if (events.length === 0) {
      setError("Select at least one event.");
      return;
    }
    try {
      if (isEdit && webhook) {
        await update.mutateAsync({ id: webhook.id, payload: { url: url.trim(), events, active } });
        toast.success("Webhook updated");
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync({ url: url.trim(), events, active });
        toast.success("Webhook created");
        setRevealedSecret(created.secret);
      }
    } catch {
      toast.error(isEdit ? "Could not update webhook" : "Could not create webhook");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {revealedSecret ? "Copy your signing secret" : isEdit ? "Edit webhook" : "New webhook"}
          </DialogTitle>
          <DialogDescription>
            {revealedSecret
              ? "This is the only time the secret is shown. Use it to verify the X-OB-Signature."
              : "POST published events to an external URL, signed with an HMAC secret."}
          </DialogDescription>
        </DialogHeader>

        {revealedSecret ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Copy this secret now — it won&apos;t be shown again.</span>
            </div>
            <CopyField value={revealedSecret} label="Signing secret" />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                placeholder="https://example.com/hooks/ob-cms"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Events</Label>
              <div className="flex flex-col gap-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={events.includes(ev)}
                      onChange={() => toggleEvent(ev)}
                    />
                    <code className="text-xs">{ev}</code>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="webhook-active">Active</Label>
              <Switch id="webhook-active" checked={active} onCheckedChange={setActive} />
            </div>
            {error && <span className="text-xs text-destructive">{error}</span>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isEdit ? "Save changes" : "Create webhook"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
