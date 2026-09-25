import { HUBSPOT_OB_SANDBOX_PORTAL_ID } from "../../hubspot-api";

const PLURAL_ENV_KEY = "HUBSPOT_ALLOWED_PORTAL_IDS";
const SINGULAR_ENV_KEY = "HUBSPOT_ALLOWED_PORTAL_ID";

const readEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.[key];
};

/** Normalize portal/account ids for consistent allow-list comparison. */
export const normalizeHubspotPortalId = (value: string): string => value.trim();

/**
 * Parse comma-separated HubSpot portal ids from env.
 * Precedence:
 * 1. `HUBSPOT_ALLOWED_PORTAL_IDS` (comma-separated)
 * 2. `HUBSPOT_ALLOWED_PORTAL_ID` (single id, backward compatible)
 * 3. Local sandbox default portal id
 */
export const resolveHubspotAllowedPortalIds = (): string[] => {
  const pluralRaw = readEnv(PLURAL_ENV_KEY);
  if (pluralRaw?.trim()) {
    const parsed = pluralRaw
      .split(",")
      .map(normalizeHubspotPortalId)
      .filter((id) => id.length > 0);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  const singular = readEnv(SINGULAR_ENV_KEY);
  if (singular?.trim()) {
    return [normalizeHubspotPortalId(singular)];
  }

  return [normalizeHubspotPortalId(HUBSPOT_OB_SANDBOX_PORTAL_ID)];
};

export const isHubspotPortalAllowed = (accountId: string): boolean => {
  const normalized = normalizeHubspotPortalId(accountId);
  const allowed = resolveHubspotAllowedPortalIds();
  return allowed.includes(normalized);
};
