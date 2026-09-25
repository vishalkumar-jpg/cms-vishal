import { describe, expect, test } from "bun:test";
import {
  HubspotAssetFetchBodyError,
  readFetchResponseBodyLimited,
} from "../hubspot-asset-fetch-body";

const MAX_BYTES = 1024;

describe("readFetchResponseBodyLimited", () => {
  test("accepts Content-Length exactly at limit", async () => {
    const body = Buffer.alloc(MAX_BYTES, 1);
    const res = new Response(body, { headers: { "content-length": String(MAX_BYTES) } });
    const read = await readFetchResponseBodyLimited(res, MAX_BYTES);
    expect(read.length).toBe(MAX_BYTES);
  });

  test("rejects Content-Length above limit before streaming", async () => {
    const res = new Response(null, { headers: { "content-length": String(MAX_BYTES + 1) } });
    await expect(readFetchResponseBodyLimited(res, MAX_BYTES)).rejects.toThrow(
      HubspotAssetFetchBodyError,
    );
  });

  test("accepts chunked response below limit", async () => {
    const res = new Response(new Uint8Array([1, 2, 3, 4]));
    const read = await readFetchResponseBodyLimited(res, MAX_BYTES);
    expect(read.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });

  test("rejects chunked response exceeding limit", async () => {
    const res = new Response(new Uint8Array(MAX_BYTES + 10));
    await expect(readFetchResponseBodyLimited(res, MAX_BYTES)).rejects.toThrow(
      HubspotAssetFetchBodyError,
    );
  });
});
