import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HUBSPOT_OB_SANDBOX_PORTAL_ID } from "../../hubspot-api";
import {
  isHubspotPortalAllowed,
  resolveHubspotAllowedPortalIds,
} from "../hubspot/hubspot-portal-allowlist";

describe("hubspot-portal-allowlist", () => {
  const originalPlural = process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
  const originalSingular = process.env.HUBSPOT_ALLOWED_PORTAL_ID;

  beforeEach(() => {
    delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
  });

  afterEach(() => {
    if (originalPlural === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_IDS = originalPlural;
    }
    if (originalSingular === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_ID = originalSingular;
    }
  });

  test("falls back to sandbox portal when env is unset", () => {
    expect(resolveHubspotAllowedPortalIds()).toEqual([HUBSPOT_OB_SANDBOX_PORTAL_ID]);
    expect(isHubspotPortalAllowed(HUBSPOT_OB_SANDBOX_PORTAL_ID)).toBe(true);
    expect(isHubspotPortalAllowed("99999999")).toBe(false);
  });

  test("supports comma-separated HUBSPOT_ALLOWED_PORTAL_IDS", () => {
    process.env.HUBSPOT_ALLOWED_PORTAL_IDS = " 51993961 , 12345678 , ,98765432 ";
    expect(resolveHubspotAllowedPortalIds()).toEqual(["51993961", "12345678", "98765432"]);
    expect(isHubspotPortalAllowed("12345678")).toBe(true);
    expect(isHubspotPortalAllowed("00000000")).toBe(false);
  });

  test("plural env takes precedence over singular", () => {
    process.env.HUBSPOT_ALLOWED_PORTAL_IDS = "11111111";
    process.env.HUBSPOT_ALLOWED_PORTAL_ID = "22222222";
    expect(resolveHubspotAllowedPortalIds()).toEqual(["11111111"]);
    expect(isHubspotPortalAllowed("22222222")).toBe(false);
  });

  test("supports backward-compatible HUBSPOT_ALLOWED_PORTAL_ID", () => {
    process.env.HUBSPOT_ALLOWED_PORTAL_ID = " 33333333 ";
    expect(resolveHubspotAllowedPortalIds()).toEqual(["33333333"]);
    expect(isHubspotPortalAllowed("33333333")).toBe(true);
  });
});
