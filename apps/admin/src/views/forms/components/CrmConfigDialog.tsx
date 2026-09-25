import * as React from "react";
import { Button, Input, Label, Switch } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useCrmConfig, useSetCrmConfig } from "../hooks/useForms";
import type { CrmConfigPayload } from "../types";

export const CrmConfigDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const { data: config } = useCrmConfig();
  const save = useSetCrmConfig();

  const [crmWebhookUrl, setCrmWebhookUrl] = React.useState("");
  const [crmLegacyUrl, setCrmLegacyUrl] = React.useState("");
  const [crmDualWrite, setCrmDualWrite] = React.useState(false);
  const [crmHmacSecret, setCrmHmacSecret] = React.useState("");

  // Seed from the fetched config whenever the dialog opens.
  React.useEffect(() => {
    if (!open || !config) return;
    setCrmWebhookUrl(config.crmWebhookUrl ?? "");
    setCrmLegacyUrl(config.crmLegacyUrl ?? "");
    setCrmDualWrite(config.crmDualWrite);
    setCrmHmacSecret("");
  }, [open, config]);

  const onSave = async (): Promise<void> => {
    const payload: CrmConfigPayload = {
      crmWebhookUrl,
      crmLegacyUrl,
      crmDualWrite,
    };
    // Only rotate the secret when the user actually typed a new one.
    if (crmHmacSecret.trim()) payload.crmHmacSecret = crmHmacSecret.trim();

    try {
      await save.mutateAsync(payload);
      toast.success("CRM settings saved");
      onOpenChange(false);
    } catch {
      toast.error("Could not save CRM settings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>CRM settings</DialogTitle>
          <DialogDescription>
            Site-level CRM delivery for all form submissions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crm-webhook">Webhook URL</Label>
            <Input
              id="crm-webhook"
              value={crmWebhookUrl}
              onChange={(e) => setCrmWebhookUrl(e.target.value)}
              placeholder="https://crm.example.com/hooks/forms"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crm-legacy">Legacy URL</Label>
            <Input
              id="crm-legacy"
              value={crmLegacyUrl}
              onChange={(e) => setCrmLegacyUrl(e.target.value)}
              placeholder="https://legacy.example.com/forms"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="flex flex-col">
              <Label htmlFor="crm-dual">Dual write</Label>
              <span className="text-xs text-muted-foreground">
                Also deliver to the legacy URL.
              </span>
            </div>
            <Switch id="crm-dual" checked={crmDualWrite} onCheckedChange={setCrmDualWrite} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crm-secret">Rotate secret</Label>
            <Input
              id="crm-secret"
              type="password"
              value={crmHmacSecret}
              onChange={(e) => setCrmHmacSecret(e.target.value)}
              placeholder={
                config?.hasSecret
                  ? "A secret is set — type to rotate"
                  : "No secret set — type to add one"
              }
            />
            <span className="text-xs text-muted-foreground">
              Leave blank to keep the current secret.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={save.isPending}>
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
