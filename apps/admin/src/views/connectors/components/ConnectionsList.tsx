import * as React from "react";
import { ChevronRight, PlugZap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConnectorIcon } from "../lib/connector-icons";
import {
  formatConnectorDate,
  getConnectionAccountLabel,
  getConnectionStatusBadge,
  getConnectorCategory,
} from "../lib/connector-display";
import type { ConnectorConnection } from "../types";

export const ConnectionsList: React.FC<{
  connections: ConnectorConnection[];
  onViewDetails: (connection: ConnectorConnection) => void;
  emptyText: string;
}> = ({ connections, onViewDetails, emptyText }) => (
  <div className="overflow-hidden rounded-lg border border-border">
    <table className="w-full table-fixed text-sm">
      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="w-[min(22%,10rem)] px-3 py-2.5 font-medium">Platform</th>
          <th className="hidden w-[min(14%,7rem)] px-3 py-2.5 font-medium sm:table-cell">
            Category
          </th>
          <th className="min-w-0 px-3 py-2.5 font-medium">Account</th>
          <th className="w-[min(16%,8rem)] px-3 py-2.5 font-medium">Status</th>
          <th className="hidden w-[min(18%,9rem)] px-3 py-2.5 font-medium md:table-cell">
            Last validated
          </th>
          <th className="w-10 px-2 py-2.5">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
          {connections.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                <PlugZap className="mx-auto mb-2 h-6 w-6 opacity-40" />
                {emptyText}
              </td>
            </tr>
          )}
          {connections.map((connection) => {
            const statusBadge = getConnectionStatusBadge(connection);
            return (
              <tr key={connection.connectionId} className="hover:bg-muted/20">
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-2 text-left"
                    onClick={() => onViewDetails(connection)}
                  >
                    <div className="shrink-0 rounded-md bg-muted p-1.5">
                      <ConnectorIcon name={connection.icon} className="h-4 w-4 text-primary" />
                    </div>
                    <span className="truncate font-medium">{connection.connectorName}</span>
                  </button>
                </td>
                <td className="hidden truncate px-3 py-2.5 text-muted-foreground sm:table-cell">
                  {getConnectorCategory(connection)}
                </td>
                <td className="truncate px-3 py-2.5 text-muted-foreground">
                  {getConnectionAccountLabel(connection)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={statusBadge.variant} className="whitespace-nowrap">
                    {statusBadge.label}
                  </Badge>
                </td>
                <td className="hidden truncate px-3 py-2.5 text-muted-foreground md:table-cell">
                  {formatConnectorDate(connection.lastValidatedAt) ?? "—"}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => onViewDetails(connection)}
                    aria-label={`View ${connection.connectorName} connection details`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  </div>
);
