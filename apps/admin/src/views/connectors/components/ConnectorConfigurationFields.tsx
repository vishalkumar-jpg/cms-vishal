import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Label } from "@/components/ui/label";
import type { ConnectorCatalogItem, ConnectorConfigurationField } from "../types";

export const buildInitialConfigurationValues = (
  fields: ConnectorConfigurationField[],
): Record<string, string> => Object.fromEntries(fields.map((field) => [field.key, ""]));

export const isConnectorConfigurationComplete = (
  fields: ConnectorConfigurationField[],
  values: Record<string, string>,
): boolean => fields.every((field) => !field.required || values[field.key]?.trim().length > 0);

export const ConnectorConfigurationFields: React.FC<{
  connector: ConnectorCatalogItem;
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onConnect: () => void;
  isPending?: boolean;
}> = ({ connector, values, onFieldChange, onConnect, isPending = false }) => {
  const config = connector.configuration;
  const fields = config?.fields ?? [];

  if (!config) {
    return (
      <p className="text-sm text-muted-foreground">
        Configuration for this connector is not available yet.
      </p>
    );
  }

  if (config.type === "oauth") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          OAuth connection for {connector.name} will be available when this connector is enabled.
        </p>
        <Button type="button" disabled>
          {config.connectLabel ?? `Connect with ${connector.name}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{connector.description}</p>
      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={`${connector.id}-${field.key}`}>{field.label}</Label>
          <Input
            id={`${connector.id}-${field.key}`}
            type={field.type === "password" ? "password" : "text"}
            autoComplete="off"
            placeholder={field.placeholder}
            value={values[field.key] ?? ""}
            onChange={(e) => onFieldChange(field.key, e.target.value)}
          />
        </div>
      ))}
      <Button
        type="button"
        onClick={onConnect}
        disabled={!isConnectorConfigurationComplete(fields, values) || isPending}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="mr-2 h-4 w-4" />
        )}
        {config.connectLabel ?? `Connect ${connector.name}`}
      </Button>
    </div>
  );
};
