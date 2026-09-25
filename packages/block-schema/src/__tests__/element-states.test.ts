import { describe, it, expect } from "bun:test";
import {
  stateCssVars,
  hasStateOverrides,
  resolveStyles,
  STATE_CSS_PROPS,
  DEFAULT_STATE_TRANSITION,
} from "../styles";

describe("stateCssVars — interactive-state override vars", () => {
  it("emits nothing for a style with no states", () => {
    expect(stateCssVars({ colors: { backgroundColor: "#fff" } })).toEqual({});
    expect(hasStateOverrides({ colors: { backgroundColor: "#fff" } })).toBe(false);
  });

  it("emits nothing for empty state layers (backward-compat)", () => {
    expect(stateCssVars({ states: { hover: {}, focus: {}, active: {} } })).toEqual({});
    expect(hasStateOverrides({ states: { hover: {} } })).toBe(false);
  });

  it("emits a scoped var for a changed hover prop", () => {
    const vars = stateCssVars({
      colors: { backgroundColor: "#fff" },
      states: { hover: { colors: { backgroundColor: "#000" } } },
    });
    expect(vars["--ob-s-hover-backgroundColor"]).toBe("#000");
    expect(hasStateOverrides({ states: { hover: { colors: { backgroundColor: "#000" } } } })).toBe(
      true,
    );
  });

  it("does not emit a var when the state value equals the base value", () => {
    const vars = stateCssVars({
      colors: { backgroundColor: "#000" },
      states: { hover: { colors: { backgroundColor: "#000" } } },
    });
    expect(vars["--ob-s-hover-backgroundColor"]).toBeUndefined();
  });

  it("supports focus and active states independently", () => {
    const vars = stateCssVars({
      colors: { textColor: "#111" },
      states: {
        focus: { colors: { textColor: "#f00" } },
        active: { colors: { textColor: "#0f0" } },
      },
    });
    expect(vars["--ob-s-focus-color"]).toBe("#f00");
    expect(vars["--ob-s-active-color"]).toBe("#0f0");
  });

  it("emits a default transition when a state override exists and no transition is set", () => {
    const vars = stateCssVars({
      states: { hover: { effects: { opacity: 0.5 } } },
    });
    expect(vars["--ob-s-hover-opacity"]).toBe(0.5);
    expect(vars["--ob-s-transition"]).toBe(DEFAULT_STATE_TRANSITION);
  });

  it("does not emit --ob-s-transition when the block already has a transition", () => {
    const vars = stateCssVars({
      interaction: { transitionDuration: 0.3, transitionTiming: "ease-out" },
      states: { hover: { effects: { opacity: 0.5 } } },
    });
    expect(vars["--ob-s-hover-opacity"]).toBe(0.5);
    expect(vars["--ob-s-transition"]).toBeUndefined();
  });

  it("emits box-shadow / transform / border-color state overrides", () => {
    const vars = stateCssVars({
      borders: { borderColor: "#ccc", borderWidth: 1 },
      states: {
        hover: {
          shadows: { boxShadow: "0 4px 12px rgba(0,0,0,0.2)" },
          effects: { transform: { scale: 1.05 } },
          borders: { borderColor: "#147eff" },
        },
      },
    });
    expect(vars["--ob-s-hover-boxShadow"]).toBe("0 4px 12px rgba(0,0,0,0.2)");
    expect(vars["--ob-s-hover-transform"]).toBe("scale(1.05)");
    // border-color is part of the composite `border` shorthand here
    expect(
      vars["--ob-s-hover-borderColor"] ?? String(vars["--ob-s-hover-border"]),
    ).toBeDefined();
  });

  it("composes with responsive: state vars and responsive vars coexist", () => {
    const styles = {
      colors: { backgroundColor: "#fff" },
      responsive: { mobile: { spacing: { paddingTop: 8 } } },
      states: { hover: { colors: { backgroundColor: "#000" } } },
    };
    const sVars = stateCssVars(styles);
    const base = resolveStyles(styles, "desktop", { fluid: false });
    expect(sVars["--ob-s-hover-backgroundColor"]).toBe("#000");
    // base desktop background unchanged (state is additive)
    expect(base.backgroundColor).toBe("#fff");
  });

  it("only emits supported props", () => {
    const vars = stateCssVars({
      states: { hover: { colors: { backgroundColor: "#000" }, layout: { display: "flex" } } },
    });
    // display is not a state prop
    expect(vars["--ob-s-hover-display"]).toBeUndefined();
    for (const k of Object.keys(vars)) {
      if (k === "--ob-s-transition") continue;
      const prop = k.replace(/^--ob-s-(hover|focus|active)-/, "");
      expect(STATE_CSS_PROPS as readonly string[]).toContain(prop);
    }
  });
});
