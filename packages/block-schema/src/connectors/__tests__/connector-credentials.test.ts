import { describe, expect, test } from "bun:test";
import type { ConnectorConfiguration } from "../connector-adapter";
import {
  CONNECTOR_PASSWORD_FIELD_TYPE,
  normalizeConnectorConfiguration,
  pickCredentialHintSource,
  resolveCredentialKeys,
  serializeConnectorCredentials,
  stripSecretKeysFromMetadata,
  validateRequiredConfigurationFields,
} from "../connector-credentials";

describe("connector-credentials", () => {
  test("normalizes string configuration values", () => {
    expect(
      normalizeConnectorConfiguration({ accessToken: "  abc  ", clientId: "id" }),
    ).toEqual({ accessToken: "abc", clientId: "id" });
  });

  test("validates required fields", () => {
    const fields = [
      { key: "clientId", label: "Client ID", type: "text" as const, required: true },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: CONNECTOR_PASSWORD_FIELD_TYPE,
        required: true,
      },
    ];

    expect(() =>
      validateRequiredConfigurationFields({ clientId: "abc" }, fields),
    ).toThrow("Client Secret is required.");
  });

  test("serializes credential keys for encrypted storage", () => {
    const config: ConnectorConfiguration = {
      type: "credentials",
      credentialKeys: ["clientId", "clientSecret"],
      fields: [],
    };
    const keys = resolveCredentialKeys(config, config.fields ?? []);
    const serialized = serializeConnectorCredentials(
      { clientId: "id", clientSecret: "secret" },
      keys,
    );

    expect(JSON.parse(serialized)).toEqual({ clientId: "id", clientSecret: "secret" });
  });

  test("picks the first secret credential for masking", () => {
    const fields = [
      { key: "clientId", label: "Client ID", type: "text" as const },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: CONNECTOR_PASSWORD_FIELD_TYPE,
        secret: true,
      },
    ];

    expect(
      pickCredentialHintSource(
        { clientId: "abc", clientSecret: "super-secret-value" },
        fields,
        ["clientId", "clientSecret"],
      ),
    ).toBe("super-secret-value");
  });

  test("strips credential-like keys from metadata", () => {
    expect(
      stripSecretKeysFromMetadata(
        { portalId: "123", accessToken: "secret", accountLabel: "prod" },
        ["accessToken"],
      ),
    ).toEqual({ portalId: "123", accountLabel: "prod" });
  });

  test("strips refreshToken from metadata via default blocklist", () => {
    expect(
      stripSecretKeysFromMetadata({
        portalId: "123",
        refreshToken: "oauth-refresh-secret",
        accountLabel: "prod",
      }),
    ).toEqual({ portalId: "123", accountLabel: "prod" });
  });
});
