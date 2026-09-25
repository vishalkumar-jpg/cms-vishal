import { describe, expect, test } from "bun:test";
import {
  assertApprovedHubspotAssetFetchUrl,
  HubspotAssetFetchUrlError,
  isApprovedHubspotAssetFetchHostname,
  isHubspotApiFetchHostname,
  resolveHubspotAssetRedirectTarget,
} from "../hubspot-asset-fetch-url";

describe("hubspot asset fetch URL validation", () => {
  test("allows approved HubSpot asset CDN host", () => {
    expect(() =>
      assertApprovedHubspotAssetFetchUrl("https://cdn2.hubspot.net/hubfs/123/a.png"),
    ).not.toThrow();
  });

  test("rejects HTTP with the HTTPS-only validation error", () => {
    expect(() =>
      assertApprovedHubspotAssetFetchUrl("http://cdn2.hubspot.net/hubfs/123/a.png"),
    ).toThrow("Asset URL must use HTTPS.");
  });

  test("rejects lookalike hubapi host", () => {
    expect(() => assertApprovedHubspotAssetFetchUrl("https://hubapi.com.attacker.example/a.png")).toThrow(
      HubspotAssetFetchUrlError,
    );
  });

  test("rejects localhost and private destinations", () => {
    expect(isApprovedHubspotAssetFetchHostname("localhost")).toBe(false);
    expect(isApprovedHubspotAssetFetchHostname("127.0.0.1")).toBe(false);
    expect(isApprovedHubspotAssetFetchHostname("192.168.1.10")).toBe(false);
    expect(() => assertApprovedHubspotAssetFetchUrl("http://127.0.0.1/a.png")).toThrow(
      HubspotAssetFetchUrlError,
    );
  });

  test("API host is approved and flagged for Authorization", () => {
    expect(isHubspotApiFetchHostname("api.hubapi.com")).toBe(true);
    expect(isHubspotApiFetchHostname("cdn2.hubspot.net")).toBe(false);
  });

  test("redirect target must pass the same host checks", () => {
    const from = new URL("https://cdn2.hubspot.net/hubfs/123/a.png");
    expect(() => resolveHubspotAssetRedirectTarget(from, "https://127.0.0.1/evil")).toThrow(
      HubspotAssetFetchUrlError,
    );
    const allowed = resolveHubspotAssetRedirectTarget(
      from,
      "https://12345.hsfs1.hubspotusercontent-na1.net/a.png",
    );
    expect(allowed.hostname.endsWith(".hubspotusercontent-na1.net")).toBe(true);
  });
});
