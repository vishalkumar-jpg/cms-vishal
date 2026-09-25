import { describe, it, expect } from "bun:test";
import { resolveStyles, buildGradientCss } from "../styles";

/**
 * Covers the props newly exposed by the deepened Style panel: gradient
 * background, transform, filter, and deep typography. Each must resolve to the
 * correct CSS so the canvas + published renderer match.
 */

describe("resolveStyles — gradient background", () => {
  it("emits a linear-gradient backgroundImage and clears backgroundColor", () => {
    const css = resolveStyles({
      colors: {
        backgroundColor: "#fff",
        backgroundGradient: {
          type: "linear",
          angle: 90,
          stops: [
            { color: "#ff0000", position: 0 },
            { color: "#0000ff", position: 100 },
          ],
        },
      },
    });
    expect(css.backgroundImage).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
    expect(css.backgroundColor).toBeUndefined();
  });

  it("supports radial + conic via buildGradientCss", () => {
    expect(
      buildGradientCss({ type: "radial", stops: [{ color: "#000", position: 0 }] }),
    ).toContain("radial-gradient");
    expect(
      buildGradientCss({ type: "conic", angle: 45, stops: [{ color: "#000", position: 0 }] }),
    ).toContain("conic-gradient(from 45deg");
  });
});

describe("resolveStyles — transform & filter", () => {
  it("composes a transform string", () => {
    const css = resolveStyles({
      effects: { transform: { translateX: 10, translateY: 5, scale: 1.2, rotate: 45 } },
    });
    expect(css.transform).toContain("translate3d(10px, 5px, 0)");
    expect(css.transform).toContain("scale(1.2)");
    expect(css.transform).toContain("rotate(45deg)");
  });

  it("composes a filter string from effects", () => {
    const css = resolveStyles({
      effects: { blur: 4, brightness: 120, grayscale: 50 },
    });
    expect(css.filter).toBe("blur(4px) brightness(120%) grayscale(50%)");
  });
});

describe("resolveStyles — deep typography", () => {
  it("resolves fontStyle, line-height, and letter-spacing (px + raw)", () => {
    const css = resolveStyles({
      typography: { fontStyle: "italic", lineHeight: 1.5, letterSpacing: 2 },
    });
    expect(css.fontStyle).toBe("italic");
    expect(css.lineHeight).toBe(1.5);
    expect(css.letterSpacing).toBe("2px");

    const raw = resolveStyles({ typography: { letterSpacing: "0.1em" } });
    expect(raw.letterSpacing).toBe("0.1em");
  });
});
