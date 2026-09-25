import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { HUBSPOT_OB_SANDBOX_PORTAL_ID } from "../../hubspot-api";

const hubspotGet = mock(async () => ({ portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID) }));

mock.module("../../hubspot-api", () => ({
  hubspotGet,
  HubspotApiError: class HubspotApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  HUBSPOT_OB_SANDBOX_PORTAL_ID,
}));

const { assertHubspotImportTokenAllowed } = await import("../hubspot/hubspot-import-token-guard");

describe("assertHubspotImportTokenAllowed", () => {
  const originalPlural = process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
  const originalEnv = process.env.HUBSPOT_ALLOWED_PORTAL_ID;

  beforeEach(() => {
    delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
    hubspotGet.mockReset();
    hubspotGet.mockImplementation(async () => ({
      portalId: Number(HUBSPOT_OB_SANDBOX_PORTAL_ID),
    }));
  });

  afterEach(() => {
    if (originalPlural === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_IDS = originalPlural;
    }
    if (originalEnv === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_ID = originalEnv;
    }
  });

  test("allows tokens for portals on the allowlist", async () => {
    await expect(assertHubspotImportTokenAllowed("pat-allowed")).resolves.toBeUndefined();
  });

  test("rejects tokens for portals not on the allowlist", async () => {
    hubspotGet.mockImplementation(async () => ({ portalId: 99999999 }));
    await expect(assertHubspotImportTokenAllowed("pat-disallowed")).rejects.toThrow(/not allowed/);
  });
});
