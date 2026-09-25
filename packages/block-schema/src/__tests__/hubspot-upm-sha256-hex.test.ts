import { describe, expect, test } from "bun:test";
import { createHash } from "crypto";
import { sha256HexFromUtf8, writeSha256MessageBitLength } from "../hubspot-upm/sha256-hex";

describe("sha256HexFromUtf8", () => {
  test("matches Node crypto SHA-256 for UTF-8 inputs", () => {
    for (const input of ["", "abc", '{"modelVersion":"1"}', "Section intro"]) {
      const expected = createHash("sha256").update(input, "utf8").digest("hex");
      expect(sha256HexFromUtf8(input)).toBe(expected);
    }
  });

  test("matches NIST SHA-256 empty and abc vectors", () => {
    expect(sha256HexFromUtf8("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256HexFromUtf8("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("writeSha256MessageBitLength encodes full 64-bit bit length big-endian", () => {
    const buf = new Uint8Array(8);
    const view = new DataView(buf.buffer);
    writeSha256MessageBitLength(view, 0, (1n << 32n) + 8n);
    expect(view.getUint32(0, false)).toBe(1);
    expect(view.getUint32(4, false)).toBe(8);

    writeSha256MessageBitLength(view, 0, 24n);
    expect(view.getUint32(0, false)).toBe(0);
    expect(view.getUint32(4, false)).toBe(24);
  });
});
