import { describe, it, expect } from "bun:test";
import {
  interactionCssVars,
  getInteractions,
  hasInteractions,
  resolveStyles,
  defaultTriggerFor,
} from "../styles";

describe("interactionCssVars — scroll / entrance interactions", () => {
  it("emits nothing when no interactions are set (byte-identical backward-compat)", () => {
    expect(interactionCssVars({})).toEqual({});
    expect(interactionCssVars({ colors: { backgroundColor: "#fff" } })).toEqual({});
    expect(hasInteractions({})).toBe(false);
  });

  it("treats effect 'none' as no reveal", () => {
    expect(interactionCssVars({ interactions: { reveal: { effect: "none" } } })).toEqual({});
    expect(hasInteractions({ interactions: { reveal: { effect: "none" } } })).toBe(false);
  });

  it("emits reveal vars with defaults", () => {
    const vars = interactionCssVars({ interactions: { reveal: { effect: "slide-up" } } });
    expect(vars["--ob-reveal-effect"]).toBe("slide-up");
    expect(vars["--ob-reveal-dur"]).toBe("0.6s");
    expect(vars["--ob-reveal-delay"]).toBe("0s");
    // `once` defaults to true → no opt-out var emitted.
    expect(vars["--ob-reveal-once"]).toBeUndefined();
    expect(hasInteractions({ interactions: { reveal: { effect: "slide-up" } } })).toBe(true);
  });

  it("honors duration, delay and once:false", () => {
    const vars = interactionCssVars({
      interactions: { reveal: { effect: "fade", duration: 1.2, delay: 0.3, once: false } },
    });
    expect(vars["--ob-reveal-effect"]).toBe("fade");
    expect(vars["--ob-reveal-dur"]).toBe("1.2s");
    expect(vars["--ob-reveal-delay"]).toBe("0.3s");
    expect(vars["--ob-reveal-once"]).toBe("0");
  });

  it("emits parallax speed and ignores 0", () => {
    expect(interactionCssVars({ interactions: { parallax: { speed: 0.3 } } })).toEqual({
      "--ob-parallax-speed": "0.3",
    });
    expect(interactionCssVars({ interactions: { parallax: { speed: 0 } } })).toEqual({});
    expect(hasInteractions({ interactions: { parallax: { speed: 0.3 } } })).toBe(true);
    expect(hasInteractions({ interactions: { parallax: { speed: 0 } } })).toBe(false);
  });

  it("composes reveal + parallax", () => {
    const vars = interactionCssVars({
      interactions: { reveal: { effect: "zoom" }, parallax: { speed: -0.5 } },
    });
    expect(vars["--ob-reveal-effect"]).toBe("zoom");
    expect(vars["--ob-parallax-speed"]).toBe("-0.5");
  });

  it("treats preset 'none' as no animation", () => {
    expect(interactionCssVars({ interactions: { animation: { preset: "none" } } })).toEqual({});
    expect(hasInteractions({ interactions: { animation: { preset: "none" } } })).toBe(false);
  });

  it("emits animation preset vars with the preset's default trigger", () => {
    const vars = interactionCssVars({ interactions: { animation: { preset: "fade-in" } } });
    expect(vars["--ob-anim-preset"]).toBe("fade-in");
    expect(vars["--ob-anim-trigger"]).toBe("scroll"); // entrance presets default to scroll
    expect(vars["--ob-anim-dur"]).toBe("0.6s");
    expect(vars["--ob-anim-delay"]).toBe("0s");
    expect(vars["--ob-anim-once"]).toBeUndefined();
    expect(hasInteractions({ interactions: { animation: { preset: "fade-in" } } })).toBe(true);
  });

  it("hover presets default to the hover trigger", () => {
    expect(defaultTriggerFor("glow-hover")).toBe("hover");
    expect(defaultTriggerFor("lift-hover")).toBe("hover");
    expect(defaultTriggerFor("slide-up")).toBe("scroll");
    const vars = interactionCssVars({ interactions: { animation: { preset: "lift-hover" } } });
    expect(vars["--ob-anim-preset"]).toBe("lift-hover");
    expect(vars["--ob-anim-trigger"]).toBe("hover");
  });

  it("honors explicit trigger, duration, delay and once:false", () => {
    const vars = interactionCssVars({
      interactions: {
        animation: { preset: "zoom-in", trigger: "click", duration: 1, delay: 0.2, once: false },
      },
    });
    expect(vars["--ob-anim-preset"]).toBe("zoom-in");
    expect(vars["--ob-anim-trigger"]).toBe("click");
    expect(vars["--ob-anim-dur"]).toBe("1s");
    expect(vars["--ob-anim-delay"]).toBe("0.2s");
    expect(vars["--ob-anim-once"]).toBe("0");
  });

  it("composes animation preset with parallax", () => {
    const vars = interactionCssVars({
      interactions: { animation: { preset: "slide-up", trigger: "load" }, parallax: { speed: 0.2 } },
    });
    expect(vars["--ob-anim-preset"]).toBe("slide-up");
    expect(vars["--ob-anim-trigger"]).toBe("load");
    expect(vars["--ob-parallax-speed"]).toBe("0.2");
  });

  it("getInteractions reads the section; resolveStyles unaffected by it", () => {
    const styles = { interactions: { reveal: { effect: "fade" } }, colors: { textColor: "#111" } };
    expect(getInteractions(styles)?.reveal?.effect).toBe("fade");
    // interactions live outside the resolved CSS map (vars are appended in lib).
    const css = resolveStyles(styles);
    expect(css["--ob-reveal-effect" as keyof typeof css]).toBeUndefined();
    expect(css.color).toBe("#111");
  });
});
