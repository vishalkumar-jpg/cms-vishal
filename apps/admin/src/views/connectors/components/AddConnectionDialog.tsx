import * as React from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ADD_CONNECTION_DIALOG_DESCRIPTION,
  ADD_CONNECTION_DIALOG_TITLE,
} from "../constants";
import { ConnectorIcon } from "../lib/connector-icons";
import { getConnectorCategory } from "../lib/connector-display";
import { ConnectorConfigurationForm } from "./ConnectorConfigurationForm";
import type { ConnectorCatalogItem } from "../types";

type DialogStep = "pick" | "configure";

export const AddConnectionDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectors: ConnectorCatalogItem[];
  onConnected?: (connectionId: string) => void;
}> = ({ open, onOpenChange, connectors, onConnected }) => {
  const [step, setStep] = React.useState<DialogStep>("pick");
  const [selectedConnector, setSelectedConnector] = React.useState<ConnectorCatalogItem | null>(
    null,
  );

  React.useEffect(() => {
    if (!open) {
      setStep("pick");
      setSelectedConnector(null);
    }
  }, [open]);

  const handleConnected = (connectionId: string): void => {
    onConnected?.(connectionId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === "pick" ? (
          <>
            <DialogHeader>
              <DialogTitle>{ADD_CONNECTION_DIALOG_TITLE}</DialogTitle>
              <DialogDescription>{ADD_CONNECTION_DIALOG_DESCRIPTION}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              {connectors.length === 0 && (
                <p className="text-sm text-muted-foreground">No connectors are available yet.</p>
              )}
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  type="button"
                  onClick={() => {
                    setSelectedConnector(connector);
                    setStep("configure");
                  }}
                  className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <ConnectorIcon name={connector.icon} className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{connector.name}</h3>
                        {connector.connectionCount > 0 && (
                          <Badge variant="success">Connected</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {getConnectorCategory(connector)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {connector.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </>
        ) : (
          selectedConnector && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setStep("pick")}
                    aria-label="Back to connector list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <DialogTitle>Connect {selectedConnector.name}</DialogTitle>
                    <DialogDescription>{selectedConnector.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <ConnectorConfigurationForm
                connector={selectedConnector}
                onConnected={handleConnected}
              />
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
};
