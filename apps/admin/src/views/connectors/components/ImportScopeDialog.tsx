import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { HUBSPOT_IMPORT_SCOPES, type HubspotImportScope } from "@ob-cms/block-schema";
import { cn } from "@/lib/cn";
import {
  HUBSPOT_IMPORT_SCOPE_DESCRIPTIONS,
  HUBSPOT_IMPORT_SCOPE_LABELS,
} from "../constants";
import { connectorErrMessage } from "../lib/connector-errors";
import { formatImportRunResultCounts } from "../lib/formatImportRunResults";
import { usePreviewImport, useRunImport } from "../hooks/useConnectors";
import type { ConnectorConnection } from "../types";

const DEFAULT_IMPORT_SCOPE = HUBSPOT_IMPORT_SCOPES[0];

export const ImportScopeDialog: React.FC<{
  connection: ConnectorConnection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ connection, open, onOpenChange }) => {
  const [scope, setScope] = React.useState<HubspotImportScope>(DEFAULT_IMPORT_SCOPE);
  const previewMut = usePreviewImport();
  const { reset: resetPreviewImport } = previewMut;
  const runMut = useRunImport();

  React.useEffect(() => {
    if (!open) {
      setScope(DEFAULT_IMPORT_SCOPE);
      resetPreviewImport();
      return;
    }
    resetPreviewImport();
  }, [open, connection.connectionId, resetPreviewImport]);

  React.useEffect(() => {
    if (!open) return;
    resetPreviewImport();
  }, [scope, open, resetPreviewImport]);

  const onScopeChange = (next: HubspotImportScope): void => {
    setScope(next);
  };

  const onPreview = (): void => {
    previewMut.mutate(
      { connectionId: connection.connectionId, scope },
      {
        onError: (e) => toast.error(connectorErrMessage(e, "Could not load import preview")),
      },
    );
  };

  const onRun = (): void => {
    runMut.mutate(
      { connectionId: connection.connectionId, scope },
      {
        onSuccess: (result) => {
          toast.success(`Import complete — ${formatImportRunResultCounts(result)}`);
          onOpenChange(false);
        },
        onError: (e) => toast.error(connectorErrMessage(e, "Import failed")),
      },
    );
  };

  const preview = previewMut.data;
  const busy = previewMut.isPending || runMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from {connection.connectorName}</DialogTitle>
          <DialogDescription>
            Import content from {connection.accountLabel ?? connection.accountId ?? "this account"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label id="import-scope-label">Scope</Label>
            <div
              role="radiogroup"
              aria-labelledby="import-scope-label"
              className="grid gap-2"
            >
              {HUBSPOT_IMPORT_SCOPES.map((value) => {
                const selected = scope === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 text-left transition-colors",
                      selected ? "border-primary bg-muted/40" : "hover:bg-muted/20",
                    )}
                  >
                    <input
                      type="radio"
                      name="hubspot-import-scope"
                      value={value}
                      checked={selected}
                      onChange={() => onScopeChange(value)}
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {HUBSPOT_IMPORT_SCOPE_LABELS[value] ?? value}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {HUBSPOT_IMPORT_SCOPE_DESCRIPTIONS[value] ?? ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onPreview} disabled={busy}>
              {previewMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Preview counts
            </Button>
            <Button type="button" onClick={onRun} disabled={busy}>
              {runMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run import
            </Button>
          </div>

          {preview && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                Pages to import: <strong>{preview.pages.toImport}</strong> (of{" "}
                {preview.pages.total})
              </p>
              <p className="mt-1">
                Posts to import: <strong>{preview.posts.toImport}</strong> (of{" "}
                {preview.posts.total})
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
