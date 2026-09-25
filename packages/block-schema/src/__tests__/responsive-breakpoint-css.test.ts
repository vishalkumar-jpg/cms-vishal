import { describe, it, expect } from "bun:test";
import {
  DESKTOP_BAND_HIDDEN_DISPLAY_VAR,
  DESKTOP_BAND_HIDDEN_MIN_WIDTH,
  renderBuilderBreakpointCss,
  renderDesktopBandHiddenCss,
  renderResponsiveBreakpointCss,
} from "../responsive-breakpoint-css";

describe("renderDesktopBandHiddenCss", () => {
  it("emits min-width rules for desktop-band hide var", () => {
    const css = renderDesktopBandHiddenCss();
    expect(css).toContain(DESKTOP_BAND_HIDDEN_DISPLAY_VAR);
    expect(css).toContain(`@container ob (min-width: ${DESKTOP_BAND_HIDDEN_MIN_WIDTH}px)`);
    expect(css).toContain(`@media (min-width: ${DESKTOP_BAND_HIDDEN_MIN_WIDTH}px)`);
    expect(css).toContain('data-ob-breakpoint="desktop"');
  });
});

describe("renderBuilderBreakpointCss", () => {
  it("emits hide-on-mobile rules scoped to the active preview breakpoint", () => {
    const css = renderBuilderBreakpointCss();
    expect(css).toContain(
      '.ob-site[data-ob-breakpoint="mobile"] [style*="--ob-r-mobile-display"]',
    );
    expect(css).toContain("--ob-r-mobile-display");
    expect(css).toContain('[data-ob-breakpoint="tablet"]');
    expect(css).toContain("--ob-r-tablet-paddingTop");
    // Draft preview sets data-ob-breakpoint but not data-ob-builder-canvas.
    expect(css).not.toContain("data-ob-builder-canvas");
  });

  it("includes preview breakpoint rules in the generated responsive overrides bundle", () => {
    const css = renderResponsiveBreakpointCss();
    expect(css).toContain("ACTIVE DEVICE PREVIEW");
    expect(css).toContain("@container ob (max-width: 767px)");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (min-width: 768px) and (max-width: 1023px)");
  });
});
