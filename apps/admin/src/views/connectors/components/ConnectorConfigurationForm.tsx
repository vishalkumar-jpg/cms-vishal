import * as React from "react";
import { toast } from "@/components/ui/toaster";
import { connectorErrMessage } from "../lib/connector-errors";
import { useCreateConnection } from "../hooks/useConnectors";
import type { ConnectorCatalogItem } from "../types";
import {
  buildInitialConfigurationValues,
  ConnectorConfigurationFields,
} from "./ConnectorConfigurationFields";

export const ConnectorConfigurationForm: React.FC<{
  connector: ConnectorCatalogItem;
  onConnected?: (connectionId: string) => void;
}> = ({ connector, onConnected }) => {
  const createMut = useCreateConnection();
  const fields = connector.configuration?.fields ?? [];
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    buildInitialConfigurationValues(fields),
  );

  React.useEffect(() => {
    setValues(buildInitialConfigurationValues(connector.configuration?.fields ?? []));
  }, [connector.id, connector.configuration]);

  const onConnect = (): void => {
    createMut.mutate(
      { connectorId: connector.id, payload: { configuration: values } },
      {
        onSuccess: (connection) => {
          setValues(buildInitialConfigurationValues(fields));
          toast.success(`${connector.name} connected`);
          onConnected?.(connection.connectionId);
        },
        onError: (e) => toast.error(connectorErrMessage(e, `Could not connect to ${connector.name}`)),
      },
    );
  };

  return (
    <ConnectorConfigurationFields
      connector={connector}
      values={values}
      onFieldChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
      onConnect={onConnect}
      isPending={createMut.isPending}
    />
  );
};
