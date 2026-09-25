import { describe, it, expect } from "bun:test";
import {
  CONTAINER_BREAKPOINT_MIN_WIDTH,
  LARGE_DESKTOP_CONTAINER_MIN_WIDTH,
  resolveStyleBreakpointFromContainerWidth,
  resolveAuthoredStyleBreakpointFromContainer,
  resolveViewportModeFromContainerWidth,
} from "../responsive-breakpoint-css";

describe("resolveStyleBreakpointFromContainerWidth", () => {
  it("maps widths to preview-aligned StyleModel breakpoints", () => {
    expect(resolveStyleBreakpointFromContainerWidth(393)).toBe("mobile");
    expect(resolveStyleBreakpointFromContainerWidth(767)).toBe("mobile");
    expect(resolveStyleBreakpointFromContainerWidth(768)).toBe("tablet");
    expect(resolveStyleBreakpointFromContainerWidth(820)).toBe("tablet");
    expect(resolveStyleBreakpointFromContainerWidth(1023)).toBe("tablet");
    expect(resolveStyleBreakpointFromContainerWidth(1024)).toBe("laptop");
    expect(resolveStyleBreakpointFromContainerWidth(1279)).toBe("laptop");
    expect(resolveStyleBreakpointFromContainerWidth(1280)).toBe("desktop");
    expect(resolveStyleBreakpointFromContainerWidth(LARGE_DESKTOP_CONTAINER_MIN_WIDTH)).toBe(
      "desktop",
    );
  });

  it("uses strict < boundaries for fractional container widths", () => {
    const { tablet, laptop, desktop } = CONTAINER_BREAKPOINT_MIN_WIDTH;

    expect(resolveStyleBreakpointFromContainerWidth(tablet - 1)).toBe("mobile");
    expect(resolveStyleBreakpointFromContainerWidth(tablet - 0.1)).toBe("mobile");
    expect(resolveStyleBreakpointFromContainerWidth(tablet)).toBe("tablet");
    expect(resolveStyleBreakpointFromContainerWidth(laptop - 0.1)).toBe("tablet");
    expect(resolveStyleBreakpointFromContainerWidth(laptop)).toBe("laptop");
    expect(resolveStyleBreakpointFromContainerWidth(desktop - 0.1)).toBe("laptop");
    expect(resolveStyleBreakpointFromContainerWidth(desktop)).toBe("desktop");
  });
});

describe("resolveViewportModeFromContainerWidth", () => {
  it("maps widths to coarse viewport buckets", () => {
    expect(resolveViewportModeFromContainerWidth(393)).toBe("mobile");
    expect(resolveViewportModeFromContainerWidth(820)).toBe("tablet");
    expect(resolveViewportModeFromContainerWidth(1024)).toBe("desktop");
    expect(resolveViewportModeFromContainerWidth(LARGE_DESKTOP_CONTAINER_MIN_WIDTH)).toBe(
      "desktop",
    );
  });

  it("uses strict < boundaries at tablet and laptop thresholds", () => {
    const { tablet, laptop } = CONTAINER_BREAKPOINT_MIN_WIDTH;

    expect(resolveViewportModeFromContainerWidth(tablet - 0.1)).toBe("mobile");
    expect(resolveViewportModeFromContainerWidth(tablet)).toBe("tablet");
    expect(resolveViewportModeFromContainerWidth(laptop - 0.1)).toBe("tablet");
    expect(resolveViewportModeFromContainerWidth(laptop)).toBe("desktop");
  });
});

describe("resolveAuthoredStyleBreakpointFromContainer", () => {
  it("matches non-desktop container labels directly", () => {
    expect(resolveAuthoredStyleBreakpointFromContainer(393, "mobile")).toBe("mobile");
    expect(resolveAuthoredStyleBreakpointFromContainer(820, "tablet")).toBe("tablet");
    expect(resolveAuthoredStyleBreakpointFromContainer(1024, "laptop")).toBe("laptop");
  });

  it("uses laptop-authored semantics for desktop container label below largeDesktop band", () => {
    const { desktop } = CONTAINER_BREAKPOINT_MIN_WIDTH;
    expect(resolveAuthoredStyleBreakpointFromContainer(desktop, "desktop")).toBe("laptop");
    expect(
      resolveAuthoredStyleBreakpointFromContainer(
        LARGE_DESKTOP_CONTAINER_MIN_WIDTH - 1,
        "desktop",
      ),
    ).toBe("laptop");
  });

  it("uses desktop fluid semantics at/above largeDesktop container band", () => {
    expect(
      resolveAuthoredStyleBreakpointFromContainer(
        LARGE_DESKTOP_CONTAINER_MIN_WIDTH,
        "desktop",
      ),
    ).toBe("desktop");
    expect(
      resolveAuthoredStyleBreakpointFromContainer(
        LARGE_DESKTOP_CONTAINER_MIN_WIDTH + 160,
        "desktop",
      ),
    ).toBe("desktop");
  });

  it("seeds desktop on SSR before width is measured", () => {
    expect(resolveAuthoredStyleBreakpointFromContainer(undefined, "desktop")).toBe("desktop");
  });
});
