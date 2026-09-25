import { describe, it, expect } from "bun:test";
import {
  resolveBinding,
  applyBindings,
  evaluateVisibleIf,
} from "../binding";

/**
 * Pure binding-resolution + visibility-evaluation logic — the contract the
 * shared render path (renderer + editor) relies on. Kept framework-free so it's
 * deterministic and SSR-safe.
 */

describe("resolveBinding", () => {
  const item = { title: "Hello", excerpt: "World", empty: "" };

  it("returns the item field value when the prop is bound + present", () => {
    expect(resolveBinding("static", "text", { text: "title" }, item)).toBe("Hello");
  });

  it("falls back to the static value when not bound", () => {
    expect(resolveBinding("static", "text", { other: "title" }, item)).toBe("static");
  });

  it("falls back to the static value outside a repeater (no item)", () => {
    expect(resolveBinding("static", "text", { text: "title" }, null)).toBe("static");
    expect(resolveBinding("static", "text", { text: "title" }, undefined)).toBe("static");
  });

  it("falls back when the bound field is missing or empty", () => {
    expect(resolveBinding("static", "text", { text: "missing" }, item)).toBe("static");
    expect(resolveBinding("static", "text", { text: "empty" }, item)).toBe("static");
  });
});

describe("applyBindings", () => {
  it("overrides only bound props, leaving others untouched", () => {
    const props = { text: "static-text", level: 2, url: "/x" };
    const out = applyBindings(props, { text: "title" }, { title: "Bound" });
    expect(out).toEqual({ text: "Bound", level: 2, url: "/x" });
  });

  it("is an identity (same reference) when there are no bindings", () => {
    const props = { text: "x" };
    expect(applyBindings(props, undefined, { title: "y" })).toBe(props);
    expect(applyBindings(props, {}, { title: "y" })).toBe(props);
  });

  it("is an identity when there is no item (outside a repeater)", () => {
    const props = { text: "x" };
    expect(applyBindings(props, { text: "title" }, null)).toBe(props);
  });
});

describe("evaluateVisibleIf", () => {
  it("shows nodes with no condition or `always`", () => {
    expect(evaluateVisibleIf(undefined, {})).toBe(true);
    expect(evaluateVisibleIf({ type: "always" }, {})).toBe(true);
  });

  it("locale eq/neq compares the active render locale", () => {
    expect(evaluateVisibleIf({ type: "locale", op: "eq", value: "es" }, { locale: "es" })).toBe(true);
    expect(evaluateVisibleIf({ type: "locale", op: "eq", value: "es" }, { locale: "en" })).toBe(false);
    expect(evaluateVisibleIf({ type: "locale", op: "neq", value: "es" }, { locale: "en" })).toBe(true);
  });

  it("authenticated defaults to true (seam) and honours the flag", () => {
    expect(evaluateVisibleIf({ type: "authenticated" }, {})).toBe(true);
    expect(evaluateVisibleIf({ type: "authenticated" }, { authenticated: false })).toBe(false);
    expect(evaluateVisibleIf({ type: "authenticated" }, { authenticated: true })).toBe(true);
  });

  it("field conditions compare a repeater item field", () => {
    const item = { featured: "yes", tag: "" };
    expect(evaluateVisibleIf({ type: "field", field: "featured", op: "eq", value: "yes" }, { item })).toBe(true);
    expect(evaluateVisibleIf({ type: "field", field: "featured", op: "eq", value: "no" }, { item })).toBe(false);
    expect(evaluateVisibleIf({ type: "field", field: "featured", op: "truthy" }, { item })).toBe(true);
    expect(evaluateVisibleIf({ type: "field", field: "tag", op: "truthy" }, { item })).toBe(false);
    expect(evaluateVisibleIf({ type: "field", field: "tag", op: "falsy" }, { item })).toBe(true);
  });

  it("audience `in`/`not-in` tests the visitor's audience set (Phase 4)", () => {
    const inA = { type: "audience" as const, audienceId: "aud_1", audienceOp: "in" as const };
    const notInA = { type: "audience" as const, audienceId: "aud_1", audienceOp: "not-in" as const };
    // Member of aud_1.
    expect(evaluateVisibleIf(inA, { audiences: ["aud_1", "aud_2"] })).toBe(true);
    expect(evaluateVisibleIf(notInA, { audiences: ["aud_1"] })).toBe(false);
    // Not a member (or unknown visitor → empty set).
    expect(evaluateVisibleIf(inA, { audiences: ["aud_2"] })).toBe(false);
    expect(evaluateVisibleIf(inA, {})).toBe(false);
    expect(evaluateVisibleIf(notInA, {})).toBe(true);
    // Default op is `in`.
    expect(evaluateVisibleIf({ type: "audience", audienceId: "aud_1" }, { audiences: ["aud_1"] })).toBe(true);
    // No target audience → no-op (always visible).
    expect(evaluateVisibleIf({ type: "audience" }, {})).toBe(true);
  });
});
