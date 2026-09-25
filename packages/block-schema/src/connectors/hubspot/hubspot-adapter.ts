import {
  ConnectorAdapter,
  ConnectorDefinition,
  ConnectorValidationResult,
} from "../connector-adapter";
import { CONNECTOR_PASSWORD_FIELD_TYPE } from "../connector-credentials";
import { hubspotGet, HubspotApiError } from "../../hubspot-api";
import {
  isHubspotPortalAllowed,
  normalizeHubspotPortalId,
  resolveHubspotAllowedPortalIds,
} from "./hubspot-portal-allowlist";

export const HUBSPOT_CONNECTOR_ID = "hubspot";

export const HUBSPOT_ACCESS_TOKEN_CREDENTIAL_KEY = "accessToken";

/** HubSpot API path that resolves portal/hub identity for a private-app token. */
export const HUBSPOT_PORTAL_INFO_API_PATH = "/integrations/v1/me";

export const HUBSPOT_CONNECTOR_DEFINITION: ConnectorDefinition = {
  id: HUBSPOT_CONNECTOR_ID,
  name: "HubSpot",
  description: "Connect your HubSpot CMS portal to import pages and posts.",
  category: "Website & Content",
  icon: "PlugZap",
  capabilities: ["pages", "posts", "assets", "import", "view-imported-content"],
  configuration: {
    type: "credentials",
    credentialKeys: [HUBSPOT_ACCESS_TOKEN_CREDENTIAL_KEY],
    connectLabel: "Connect HubSpot",
    fields: [
      {
        key: "accessToken",
        label: "Private app access token",
        type: CONNECTOR_PASSWORD_FIELD_TYPE,
        required: true,
        placeholder: "Paste HubSpot private-app token",
        secret: true,
      },
    ],
  },
};

export class HubspotAdapter implements ConnectorAdapter {
  readonly definition = HUBSPOT_CONNECTOR_DEFINITION;

  async validate(configuration: Record<string, string>): Promise<ConnectorValidationResult> {
    const token = configuration.accessToken?.trim();
    if (!token) {
      throw new Error("Private app access token is required.");
    }

    try {
      const info = await hubspotGet<{ portalId?: number; hubId?: number }>(
        token,
        HUBSPOT_PORTAL_INFO_API_PATH,
      );
      const accountId = info.portalId ?? info.hubId;
      if (!accountId) {
        throw new Error("HubSpot token validated but portal id was missing.");
      }
      const metadata: Record<string, unknown> = {};
      if (info.portalId != null) metadata.portalId = String(info.portalId);
      if (info.hubId != null) metadata.hubId = String(info.hubId);

      try {
        const accountInfo = await hubspotGet<{ uiDomain?: string }>(
          token,
          "/account-info/v3/details",
        );
        const uiDomain = accountInfo.uiDomain?.trim();
        if (uiDomain) {
          metadata.accountLabel = uiDomain;
        }
      } catch {
        // account-info is optional enrichment; portal identity from /me is sufficient
      }

      return {
        accountId: String(accountId),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } catch (err) {
      if (err instanceof HubspotApiError) {
        throw new Error(err.message);
      }
      throw err;
    }
  }

  assertAllowed(validation: ConnectorValidationResult): void {
    const accountId = normalizeHubspotPortalId(validation.accountId);
    if (!isHubspotPortalAllowed(accountId)) {
      const allowedCount = resolveHubspotAllowedPortalIds().length;
      throw new Error(
        `HubSpot portal ${accountId} is not allowed. Connect only explicitly allowed portals (${allowedCount} configured).`,
      );
    }
  }
}
