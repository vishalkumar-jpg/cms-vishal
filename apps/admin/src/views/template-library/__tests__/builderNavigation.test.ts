import { describe, expect, it } from "bun:test";
import {
  builderPathWithPanel,
  getLastBuilderPageId,
  rememberLastBuilderPage,
  resolveInsertInBuilderPath,
} from "../lib/builderNavigation";

const installSessionStorageMock = (): (() => void) => {
  const original = globalThis.sessionStorage;
  const memory = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: () => null,
    length: memory.size,
  } as Storage;

  return () => {
    globalThis.sessionStorage = original;
  };
};

describe("builderNavigation", () => {
  it("builds builder path with panel query", () => {
    expect(builderPathWithPanel("pg_1", "templates")).toBe("/pages/pg_1/builder?panel=templates");
    expect(builderPathWithPanel("pg_1")).toBe("/pages/pg_1/builder");
  });

  it("remembers and resolves last builder page per site", () => {
    const restore = installSessionStorageMock();
    try {
      rememberLastBuilderPage("site-a", "pg_last");
      expect(getLastBuilderPageId("site-a")).toBe("pg_last");
      expect(resolveInsertInBuilderPath("site-a")).toBe("/pages/pg_last/builder?panel=templates");
      expect(resolveInsertInBuilderPath("site-unknown")).toBe(null);
    } finally {
      restore();
    }
  });
});
