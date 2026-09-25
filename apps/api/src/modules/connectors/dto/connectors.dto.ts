import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";
import type {
  ConnectorConfiguration,
  ConnectorConfigurationField,
} from "@ob-cms/block-schema";

export class ConnectConnectorDto {
  @ApiProperty({
    description: "Connector-specific configuration values keyed by field id",
    example: { accessToken: "pat-..." },
  })
  @IsObject()
  configuration!: Record<string, string>;
}

/** Safe connection details — never includes plaintext credentials. */
export interface ConnectorConnectionDto {
  connectionId: string;
  connectorId: string;
  connectorName: string;
  category?: string;
  icon: string;
  connected: boolean;
  accountId: string | null;
  accountLabel: string | null;
  credentialHint: string | null;
  connectedAt: string | null;
  lastValidatedAt: string | null;
  metadata: Record<string, unknown>;
}

/** Catalog entry from the connector registry with connection summary for Admin. */
export interface ConnectorCatalogItemDto {
  id: string;
  name: string;
  description: string;
  category?: string;
  icon: string;
  capabilities: string[];
  configuration?: ConnectorConfiguration;
  connectionCount: number;
}

export type { ConnectorConfiguration, ConnectorConfigurationField };
