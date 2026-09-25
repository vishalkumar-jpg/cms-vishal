import type { ConnectorConfiguration, ConnectorConfigurationField } from "./connector-adapter";

/** Connector configuration field type value for secret password inputs. */
export const CONNECTOR_PASSWORD_FIELD_TYPE = "password" as const;

/** Trim string values in a connector configuration payload. */
export const normalizeConnectorConfiguration = (
  configuration: Record<string, unknown>,
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(configuration)) {
    if (typeof value === "string") {
      normalized[key] = value.trim();
    }
  }
  return normalized;
};

export const validateRequiredConfigurationFields = (
  configuration: Record<string, string>,
  fields: ConnectorConfigurationField[],
): void => {
  for (const field of fields) {
    if (!field.required) continue;
    const value = configuration[field.key];
    if (!value) {
      throw new Error(`${field.label} is required.`);
    }
  }
};

/** Resolve which field keys are persisted in the encrypted credential envelope. */
export const resolveCredentialKeys = (
  config: ConnectorConfiguration,
  fields: ConnectorConfigurationField[],
): string[] => {
  if (config.credentialKeys?.length) {
    return config.credentialKeys;
  }
  return fields
    .filter((field) => field.secret ?? field.type === CONNECTOR_PASSWORD_FIELD_TYPE)
    .map((field) => field.key);
};

/** Build the opaque credential blob stored encrypted at rest. */
/** Parse decrypted credential JSON stored for a connector connection. */
export const parseConnectorCredentials = (serialized: string): Record<string, string> => {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
};

export const serializeConnectorCredentials = (
  configuration: Record<string, string>,
  credentialKeys: string[],
): string => {
  const payload: Record<string, string> = {};
  for (const key of credentialKeys) {
    const value = configuration[key];
    if (value) payload[key] = value;
  }
  return JSON.stringify(payload);
};

/** Pick the best source value for a masked credential hint. */
export const pickCredentialHintSource = (
  configuration: Record<string, string>,
  fields: ConnectorConfigurationField[],
  credentialKeys: string[],
): string => {
  for (const field of fields) {
    const isSecret = field.secret ?? field.type === CONNECTOR_PASSWORD_FIELD_TYPE;
    if (!isSecret) continue;
    const value = configuration[field.key];
    if (value) return value;
  }
  for (const key of credentialKeys) {
    const value = configuration[key];
    if (value) return value;
  }
  const firstField = fields[0];
  return firstField ? (configuration[firstField.key] ?? "") : "";
};

const METADATA_SECRET_KEY_BLOCKLIST = new Set([
  "accessToken",
  "clientSecret",
  "password",
  "refreshToken",
  "token",
  "secret",
  "apiKey",
]);

/** Remove credential-like keys from provider metadata before persistence or API responses. */
export const stripSecretKeysFromMetadata = (
  metadata: Record<string, unknown>,
  credentialKeys: string[] = [],
): Record<string, unknown> => {
  const blocked = new Set([...credentialKeys, ...METADATA_SECRET_KEY_BLOCKLIST]);
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.has(key)) continue;
    safe[key] = value;
  }
  return safe;
};
