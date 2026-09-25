/**
 * Minimal provider-agnostic connector contract.
 *
 * Adapters are responsible ONLY for provider-specific API behavior.
 * Encryption, persistence, lifecycle orchestration, and safe response shaping
 * remain in the CMS service layer so future adapters (Salesforce, Google, …)
 * never need to know about the CMS database or encryption implementation.
 */

export type ConnectorConfigurationType = "credentials" | "oauth";

export type ConnectorConfigurationFieldType = "text" | "password";

/** One user-editable configuration field rendered by the generic Admin form. */
export interface ConnectorConfigurationField {
  key: string;
  label: string;
  type: ConnectorConfigurationFieldType;
  required?: boolean;
  placeholder?: string;
  /** When true (default for password), value is treated as secret. */
  secret?: boolean;
}

/** Describes how Admin collects and submits connector configuration. */
export interface ConnectorConfiguration {
  type: ConnectorConfigurationType;
  fields?: ConnectorConfigurationField[];
  /** Keys from `fields` persisted in the encrypted credential envelope (defaults to secret fields). */
  credentialKeys?: string[];
  connectLabel?: string;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  /** Dashboard grouping label (e.g. "Website & Content"). */
  category?: string;
  icon: string;
  capabilities: string[];
  configuration?: ConnectorConfiguration;
}

export interface ConnectorStatus {
  connected: boolean;
  provider: string;
  portalId?: string | null;
  tokenHint?: string | null;
  connectedAt?: string | null;
  lastValidatedAt?: string | null;
}

export interface ConnectorValidationResult {
  /** Provider-neutral account identifier (e.g. HubSpot portal id). */
  accountId: string;
  /** Optional provider-specific fields that do not belong in the generic contract. */
  metadata?: Record<string, unknown>;
}

export interface ConnectorAdapter {
  definition: ConnectorDefinition;
  validate(configuration: Record<string, string>): Promise<ConnectorValidationResult>;
  /** Optional post-validation guard (e.g. portal allow-list). */
  assertAllowed?(validation: ConnectorValidationResult): void;
}
