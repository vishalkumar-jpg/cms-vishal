import { describe, it, expect } from "bun:test";
import {
  getCustomCss,
  sanitizeCustomCss,
  scopeCustomCss,
  NODE_SCOPE_ATTR,
} from "../custom-css";

describe("custom CSS scoping", () => {
  it("reads customCss from styles", () => {
    expect(getCustomCss({})).toBeUndefined();
    expect(getCustomCss({ customCss: "  color: red; " })).toBe("color: red;");
  });

  it("rejects dangerous CSS", () => {
    expect(sanitizeCustomCss("@import url(x);")).toBe("");
    expect(sanitizeCustomCss("background: url(javascript:alert(1))")).toBe("");
    expect(sanitizeCustomCss('<style>body{color:red}</style>')).toBe("");
  });

  it("scopes declaration-only blocks to the node attribute", () => {
    const out = scopeCustomCss("color: red;", "node-1", "node");
    expect(out).toBe(`[${NODE_SCOPE_ATTR}="node-1"]{color: red;}`);
  });

  it("scopes selectors and & alias", () => {
    const out = scopeCustomCss("& { padding: 8px; } .title { font-weight: 700; }", "abc", "node");
    expect(out).toContain(`[${NODE_SCOPE_ATTR}="abc"]{ padding: 8px; }`);
    expect(out).toContain(`[${NODE_SCOPE_ATTR}="abc"] .title{ font-weight: 700; }`);
  });

  it("uses child selector for SSR wrapper target", () => {
    const out = scopeCustomCss("& { color: blue; }", "x", "child");
    expect(out).toBe(`[${NODE_SCOPE_ATTR}="x"] > *{ color: blue; }`);
  });

  it("scopes rules inside @media", () => {
    const out = scopeCustomCss("@media (min-width: 768px) { h2 { color: green; } }", "n1", "node");
    expect(out).toContain("@media (min-width: 768px)");
    expect(out).toContain(`[${NODE_SCOPE_ATTR}="n1"] h2{ color: green; }`);
  });
});
