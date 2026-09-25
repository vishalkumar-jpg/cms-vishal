import { describe, it, expect } from "bun:test";
import { resolveStyles, responsiveCssVars } from "../styles";

describe("resolveStyles — breakpoint cascade", () => {
  const styles = {
    spacing: { paddingTop: 48 },
    typography: { fontSize: 24 },
    responsive: {
      laptop: { spacing: { paddingTop: 32 } },
      tablet: { spacing: { paddingTop: 24 } },
      mobile: { spacing: { paddingTop: 8 }, typography: { fontSize: 14 } },
    },
  };

  it("desktop resolves the base layer", () => {
    const css = resolveStyles(styles, "desktop", { fluid: false });
    expect(css.paddingTop).toBe("48px");
    expect(css.fontSize).toBe("24px");
  });

  it("laptop inherits desktop then applies laptop override", () => {
    const css = resolveStyles(styles, "laptop", { fluid: false });
    expect(css.paddingTop).toBe("32px");
    expect(css.fontSize).toBe("24px");
  });

  it("tablet inherits laptop then applies tablet override", () => {
    const css = resolveStyles(styles, "tablet", { fluid: false });
    expect(css.paddingTop).toBe("24px");
    expect(css.fontSize).toBe("24px");
  });

  it("mobile cascades desktop -> laptop -> tablet -> mobile", () => {
    const css = resolveStyles(styles, "mobile", { fluid: false });
    expect(css.paddingTop).toBe("8px");
    expect(css.fontSize).toBe("14px");
  });

  it("largeDesktop is independent from laptop overrides", () => {
    const wide = {
      spacing: { paddingTop: 48 },
      responsive: {
        largeDesktop: { spacing: { paddingTop: 64 } },
        laptop: { spacing: { paddingTop: 32 } },
      },
    };
    expect(resolveStyles(wide, "largeDesktop", { fluid: false }).paddingTop).toBe("64px");
    expect(resolveStyles(wide, "laptop", { fluid: false }).paddingTop).toBe("32px");
  });
});

describe("responsiveCssVars — inline override vars", () => {
  it("emits nothing for a single-layer (no responsive) style", () => {
    expect(responsiveCssVars({ spacing: { paddingTop: 48 } })).toEqual({});
  });

  it("emits only CHANGED properties per breakpoint", () => {
    const vars = responsiveCssVars({
      spacing: { paddingTop: 48 },
      typography: { fontSize: 24 },
      responsive: {
        mobile: { spacing: { paddingTop: 8 } },
      },
    });
    expect(vars["--ob-r-mobile-paddingTop"]).toBe("8px");
    // fontSize unchanged at mobile → not emitted
    expect(vars["--ob-r-mobile-fontSize"]).toBeUndefined();
    // tablet had no layer → no vars
    expect(vars["--ob-r-tablet-paddingTop"]).toBeUndefined();
  });

  it("emits display:none for a hidden-on-device flag", () => {
    const vars = responsiveCssVars({
      responsive: { mobile: { hidden: true } },
    });
    expect(vars["--ob-r-mobile-display"]).toBe("none");
  });

  it("emits desktop-band hide var for responsive.desktop.hidden", () => {
    const vars = responsiveCssVars({
      responsive: { desktop: { hidden: true } },
    });
    expect(vars["--ob-r-desktop-band-display"]).toBe("none");
    expect(vars["--ob-r-mobile-display"]).toBeUndefined();
  });

  it("hidden flag wins over a layout display override at the same breakpoint", () => {
    const vars = responsiveCssVars({
      layout: { display: "flex" },
      responsive: {
        mobile: { hidden: true, layout: { display: "block" } },
      },
    });
    expect(vars["--ob-r-mobile-display"]).toBe("none");
    expect(vars["--ob-r-mobile-display"]).not.toBe("block");
  });

  it("emits a var when the user explicitly pins an override equal to the parent value", () => {
    const vars = responsiveCssVars({
      spacing: { paddingTop: 24 },
      responsive: { tablet: { spacing: { paddingTop: 24 } } },
    });
    expect(vars["--ob-r-tablet-paddingTop"]).toBe("24px");
  });

  it("does not emit mobile var when only tablet changed", () => {
    const vars = responsiveCssVars({
      spacing: { paddingTop: 48 },
      responsive: {
        tablet: { spacing: { paddingTop: 24 } },
      },
    });
    expect(vars["--ob-r-tablet-paddingTop"]).toBe("24px");
    expect(vars["--ob-r-mobile-paddingTop"]).toBeUndefined();
  });

  it("emits laptop overrides independently", () => {
    const vars = responsiveCssVars({
      spacing: { paddingTop: 48 },
      responsive: {
        laptop: { spacing: { paddingTop: 32 } },
      },
    });
    expect(vars["--ob-r-laptop-paddingTop"]).toBe("32px");
    expect(vars["--ob-r-tablet-paddingTop"]).toBeUndefined();
  });

  it("emits gridTemplateColumns when it changes at a breakpoint", () => {
    const vars = responsiveCssVars({
      layout: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)" },
      responsive: {
        mobile: { layout: { gridTemplateColumns: "1fr" } },
      },
    });
    expect(vars["--ob-r-mobile-gridTemplateColumns"]).toBe("1fr");
  });
});

describe("backward compatibility", () => {
  it("resolveStyles output is unchanged for styles with no responsive layer", () => {
    const base = { spacing: { paddingTop: 16 }, colors: { backgroundColor: "#fff" } };
    const css = resolveStyles(base, "desktop", { fluid: false });
    expect(css.paddingTop).toBe("16px");
    expect(css.backgroundColor).toBe("#fff");
    expect(responsiveCssVars(base)).toEqual({});
  });
});
