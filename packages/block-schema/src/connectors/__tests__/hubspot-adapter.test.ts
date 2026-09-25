import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HUBSPOT_OB_SANDBOX_PORTAL_ID } from "../../hubspot-api";
import { HubspotAdapter } from "../hubspot/hubspot-adapter";

describe("HubspotAdapter.assertAllowed", () => {
  const originalPlural = process.env.HUBSPOT_ALLOWED_PORTAL_IDS;
  const originalEnv = process.env.HUBSPOT_ALLOWED_PORTAL_ID;
  const adapter = new HubspotAdapter();

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
    if (originalEnv === undefined) {
      delete process.env.HUBSPOT_ALLOWED_PORTAL_ID;
    } else {
      process.env.HUBSPOT_ALLOWED_PORTAL_ID = originalEnv;
    }
  });

  test("allows multiple configured portals", () => {
    process.env.HUBSPOT_ALLOWED_PORTAL_IDS = `${HUBSPOT_OB_SANDBOX_PORTAL_ID},99999999`;
    expect(() => adapter.assertAllowed?.({ accountId: "99999999" })).not.toThrow();
  });

  test("allows the configured sandbox portal", () => {
    expect(() =>
      adapter.assertAllowed?.({ accountId: HUBSPOT_OB_SANDBOX_PORTAL_ID }),
    ).not.toThrow();
  });

  test("rejects disallowed portals", () => {
    expect(() => adapter.assertAllowed?.({ accountId: "99999999" })).toThrow(
      /not allowed/,
    );
  });
});
