import * as React from "react";
import { Download, Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { hasRoleAtLeast } from "@ob-cms/shared";
import { useActiveRole } from "@/hooks/useActiveRole";
import { ConnectorIcon } from "../lib/connector-icons";
import {
  formatConnectorDate,
  getConnectionIdentityFields,
  getConnectionStatusBadge,
  getConnectorCategory,
} from "../lib/connector-display";
import { connectorErrMessage } from "../lib/connector-errors";
import { connectionSupportsImport } from "../lib/connection-capabilities";
import {
  CONNECTION_DETAILS_DIALOG_TITLE,
  DISCONNECT_ACCOUNT_BUTTON,
  IMPORT_PAGES_POSTS_BUTTON,
} from "../constants";
import { useDisconnectConnection, useImportRuns } from "../hooks/useConnectors";
import { ImportActivitySection } from "./ImportActivitySection";
import { ImportScopeDialog } from "./ImportScopeDialog";
import type { ConnectorCatalogItem, ConnectorConnection } from "../types";

export const ConnectionDetailsDialog: React.FC<{
  connection: ConnectorConnection | null;
  catalog: ConnectorCatalogItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ connection, catalog, open, onOpenChange }) => {
  const role = useActiveRole();
  const canManage = role != null && hasRoleAtLeast(role, "site_admin");
  const confirm = useConfirm();
  const disconnectMut = useDisconnectConnection();
  const [importOpen, setImportOpen] = React.useState(false);

  const connectionId = connection?.connectionId;
  const importRunsEnabled = canManage && open && !!connectionId;
  const {
    data: importRuns = [],
    isLoading: runsLoading,
    isError: runsError,
  } = useImportRuns(connectionId, { enabled: importRunsEnabled });

  React.useEffect(() => {
    if (!open) {
      setImportOpen(false);
    }
  }, [open]);

  if (!connection) {
    return null;
  }

  const identityFields = getConnectionIdentityFields(connection);
  const statusBadge = getConnectionStatusBadge(connection);
  const canImport =
    connection.connected && connectionSupportsImport(connection, catalog);

  const onDisconnect = (): void => {
    void (async () => {
      const ok = await confirm({
        title: `Disconnect ${connection.connectorName}?`,
        description: "Stored credentials will be removed. You can reconnect later.",
        confirmLabel: "Disconnect",
        destructive: true,
      });
      if (!ok) return;

      disconnectMut.mutate(connection.connectionId, {
        onSuccess: () => {
          toast.success(`${connection.connectorName} disconnected`);
          onOpenChange(false);
        },
        onError: (e) => toast.error(connectorErrMessage(e, "Disconnect failed")),
      });
    })();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{CONNECTION_DETAILS_DIALOG_TITLE}</DialogTitle>
          </DialogHeader>

          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2">
              <ConnectorIcon name={connection.icon} className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{connection.connectorName}</h2>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{getConnectorCategory(connection)}</p>
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {identityFields.map((field) => (
              <div key={field.label}>
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="font-medium">{field.value}</dd>
              </div>
            ))}
            {connection.credentialHint && (
              <div>
                <dt className="text-muted-foreground">Credential</dt>
                <dd className="font-mono text-xs">{connection.credentialHint}</dd>
              </div>
            )}
            {formatConnectorDate(connection.connectedAt) && (
              <div>
                <dt className="text-muted-foreground">Connected</dt>
                <dd>{formatConnectorDate(connection.connectedAt)}</dd>
              </div>
            )}
            {formatConnectorDate(connection.lastValidatedAt) && (
              <div>
                <dt className="text-muted-foreground">Last validated</dt>
                <dd>{formatConnectorDate(connection.lastValidatedAt)}</dd>
              </div>
            )}
          </dl>

          {canManage && (
            <ImportActivitySection
              runs={importRuns}
              isLoading={runsLoading}
              isError={runsError}
              embedded
            />
          )}

          {canManage && connection.connected && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {canImport && (
                <Button type="button" variant="default" onClick={() => setImportOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  {IMPORT_PAGES_POSTS_BUTTON}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onDisconnect}
                disabled={disconnectMut.isPending}
              >
                {disconnectMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 h-4 w-4" />
                )}
                {DISCONNECT_ACCOUNT_BUTTON}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canImport && (
        <ImportScopeDialog
          connection={connection}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}
    </>
  );
};
