export interface ConnectorConfigurationField {
  key: string;
  label: string;
  type: "text" | "password";
  required?: boolean;
  placeholder?: string;
  secret?: boolean;
}

export interface ConnectorConfiguration {
  type: "credentials" | "oauth";
  fields?: ConnectorConfigurationField[];
  credentialKeys?: string[];
  connectLabel?: string;
}

export interface ConnectorConnection {
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

export interface ConnectorCatalogItem {
  id: string;
  name: string;
  description: string;
  category?: string;
  icon: string;
  capabilities: string[];
  configuration?: ConnectorConfiguration;
  connectionCount: number;
}

export interface ConnectConnectorPayload {
  configuration: Record<string, string>;
}

export interface ImportRunSummary {
  importedPages: number;
  importedPosts: number;
  /** Present on newer import runs when existing OB pages were updated instead of created. */
  updatedPages?: number;
  /** Present on newer import runs when existing OB posts were updated instead of created. */
  updatedPosts?: number;
  skipped: { name: string; reason: string }[];
}

export interface ImportRun {
  runId: string;
  connectionId: string;
  connectorId: string;
  connectorName: string;
  accountId: string | null;
  accountLabel: string | null;
  scope: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  resultSummary: ImportRunSummary;
  errorMessage: string | null;
}

export interface ConnectorImportRunResponse extends ImportRunSummary {
  runId: string;
}

export interface HubspotScopedImportPreview {
  scope: string;
  pages: { total: number; published: number; unpublished: number; toImport: number };
  posts: { total: number; published: number; unpublished: number; toImport: number };
}
