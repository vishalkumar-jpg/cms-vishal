import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { useSiteStore } from "@/store/siteStore";
import { ADD_CONNECTOR_BUTTON, CONNECTORS_PAGE_DESCRIPTION } from "./constants";
import { AddConnectionDialog } from "./components/AddConnectionDialog";
import { ConnectionDetailsDialog } from "./components/ConnectionDetailsDialog";
import { ConnectionsList } from "./components/ConnectionsList";
import { useConnectorsCatalog, useConnections } from "./hooks/useConnectors";
import type { ConnectorConnection } from "./types";

export const Connectors: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const {
    data: catalog = [],
    isLoading: catalogLoading,
    isError: catalogError,
  } = useConnectorsCatalog();
  const {
    data: connections = [],
    isLoading: connectionsLoading,
    isFetching: connectionsFetching,
    isError: connectionsError,
  } = useConnections();

  const [addOpen, setAddOpen] = React.useState(false);
  const [detailsConnectionId, setDetailsConnectionId] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const isLoading = catalogLoading || connectionsLoading;
  const isError = catalogError || connectionsError;

  const detailsConnection =
    connections.find((c) => c.connectionId === detailsConnectionId) ?? null;

  React.useEffect(() => {
    if (
      detailsOpen &&
      detailsConnectionId &&
      !detailsConnection &&
      !connectionsLoading &&
      !connectionsFetching
    ) {
      setDetailsOpen(false);
      setDetailsConnectionId(null);
    }
  }, [
    detailsOpen,
    detailsConnectionId,
    detailsConnection,
    connectionsLoading,
    connectionsFetching,
  ]);

  let emptyText = "No connections yet. Add a platform connection to get started.";
  if (!siteId) emptyText = "Select a site to manage connectors.";
  else if (isLoading) emptyText = "Loading connections…";
  else if (isError) emptyText = "Could not load connections.";

  const openDetails = (connection: ConnectorConnection): void => {
    setDetailsConnectionId(connection.connectionId);
    setDetailsOpen(true);
  };

  const onConnected = (connectionId: string): void => {
    setDetailsConnectionId(connectionId);
    setDetailsOpen(true);
  };

  return (
    <PageContainer className="max-w-6xl">
      <p className="mb-2 text-sm text-muted-foreground">
        Admin <span aria-hidden="true">&gt;</span> Connectors
      </p>

      <PageHeader>
        <div>
          <h1 className="text-2xl font-semibold">Connectors</h1>
          <p className="mt-1 text-sm text-muted-foreground">{CONNECTORS_PAGE_DESCRIPTION}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!siteId || isLoading || isError}>
          <Plus className="mr-1.5 h-4 w-4" />
          {ADD_CONNECTOR_BUTTON}
        </Button>
      </PageHeader>

      <h2 className="mb-3 text-sm font-medium text-foreground">Connections</h2>
      <ConnectionsList
        connections={connections}
        onViewDetails={openDetails}
        emptyText={emptyText}
      />

      <AddConnectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        connectors={catalog}
        onConnected={onConnected}
      />

      <ConnectionDetailsDialog
        connection={detailsConnection}
        catalog={catalog}
        open={detailsOpen && detailsConnection != null}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setDetailsConnectionId(null);
          }
        }}
      />
    </PageContainer>
  );
};
