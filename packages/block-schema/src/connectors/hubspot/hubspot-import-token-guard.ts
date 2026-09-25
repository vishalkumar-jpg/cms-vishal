import { hubspotGet, HubspotApiError } from "../../hubspot-api";
import { HubspotAdapter, HUBSPOT_PORTAL_INFO_API_PATH } from "./hubspot-adapter";

/**
 * Resolve the HubSpot portal for a private-app token and enforce the configured
 * portal allowlist (same rules as connector connect via {@link HubspotAdapter.assertAllowed}).
 */
export const assertHubspotImportTokenAllowed = async (token: string): Promise<void> => {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Private app access token is required.");
  }

  try {
    const info = await hubspotGet<{ portalId?: number; hubId?: number }>(
      trimmed,
      HUBSPOT_PORTAL_INFO_API_PATH,
    );
    const accountId = info.portalId ?? info.hubId;
    if (!accountId) {
      throw new Error("HubSpot token validated but portal id was missing.");
    }
    new HubspotAdapter().assertAllowed({ accountId: String(accountId) });
  } catch (err) {
    if (err instanceof HubspotApiError) {
      throw new Error(err.message);
    }
    throw err;
  }
};
