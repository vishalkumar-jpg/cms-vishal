import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectorConfigurationFields } from "../components/ConnectorConfigurationFields";
import type { ConnectorCatalogItem } from "../types";

const SALESFORCE_FIXTURE: ConnectorCatalogItem = {
  id: "salesforce",
  name: "Salesforce",
  description: "Connect Salesforce to sync CRM data.",
  category: "CRM",
  icon: "Globe",
  capabilities: ["accounts"],
  connectionCount: 0,
  configuration: {
    type: "credentials",
    credentialKeys: ["clientId", "clientSecret"],
    connectLabel: "Connect Salesforce",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        required: true,
        placeholder: "Enter client ID",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        required: true,
        placeholder: "Enter client secret",
        secret: true,
      },
    ],
  },
};

describe("ConnectorConfigurationFields", () => {
  it("renders configuration fields from the connector definition", () => {
    const html = renderToStaticMarkup(
      <ConnectorConfigurationFields
        connector={SALESFORCE_FIXTURE}
        values={{ clientId: "", clientSecret: "" }}
        onFieldChange={() => undefined}
        onConnect={() => undefined}
      />,
    );

    expect(html.includes("Client ID")).toBe(true);
    expect(html.includes("Client Secret")).toBe(true);
    expect(html.includes("Connect Salesforce")).toBe(true);
  });
});
