import { describe, it, expect } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEVICE_PRESETS,
  DeviceFrame,
  PREVIEW_MOBILE_VIEWPORT_W,
  PREVIEW_TABLET_VIEWPORT_W,
  viewportFor,
} from "../DeviceFrame";
import { RESP_MOBILE_W, RESP_TABLET_W } from "@ob-cms/block-schema";

describe("DeviceFrame preview viewport", () => {
  it("aligns mobile/tablet preset widths with published container breakpoints", () => {
    expect(PREVIEW_MOBILE_VIEWPORT_W).toBe(RESP_MOBILE_W);
    expect(PREVIEW_TABLET_VIEWPORT_W).toBe(RESP_TABLET_W);
    expect(DEVICE_PRESETS.find((d) => d.key === "iphone15")?.width).toBe(RESP_MOBILE_W);
    expect(DEVICE_PRESETS.find((d) => d.key === "ipad")?.width).toBe(RESP_TABLET_W);
  });

  it("does not apply transform scale on framed devices (1:1 CSS pixels)", () => {
    const preset = DEVICE_PRESETS.find((d) => d.key === "iphone15")!;
    const html = renderToStaticMarkup(
      React.createElement(DeviceFrame, {
        preset,
        orientation: "portrait",
        children: React.createElement("div", { className: "ob-site" }, "content"),
      }),
    );
    expect(html).not.toContain("scale(");
    expect(html).not.toContain("transform:");
    expect(html).toContain(`width:${viewportFor(preset, "portrait").width}px`);
    expect(html).toContain("data-device-frame");
  });

  it("desktop preset renders full-bleed without device frame chrome", () => {
    const preset = DEVICE_PRESETS.find((d) => d.key === "desktop")!;
    const html = renderToStaticMarkup(
      React.createElement(DeviceFrame, {
        preset,
        orientation: "portrait",
        children: React.createElement("div", { className: "ob-site" }, "content"),
      }),
    );
    expect(html).not.toContain("data-device-frame");
    expect(html).toContain("w-full");
  });
});
