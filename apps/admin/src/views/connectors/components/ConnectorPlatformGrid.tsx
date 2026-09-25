import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ConnectorIcon } from "../lib/connector-icons";
import { getConnectorCategory } from "../lib/connector-display";
import type { ConnectorCatalogItem } from "../types";

export const ConnectorPlatformGrid: React.FC<{ connectors: ConnectorCatalogItem[] }> = ({
  connectors,
}) => {
  if (connectors.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-foreground">Available platforms</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {connectors.map((connector) => (
          <div
            key={connector.id}
            className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="rounded-md bg-muted p-2">
              <ConnectorIcon name={connector.icon} className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{connector.name}</h3>
                {connector.connectionCount > 0 && <Badge variant="success">Connected</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {getConnectorCategory(connector)}
              </p>
              {connector.connectionCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {connector.connectionCount}{" "}
                  {connector.connectionCount === 1 ? "connection" : "connections"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
