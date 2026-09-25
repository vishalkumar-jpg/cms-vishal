import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StarterTemplateThumbnailFallback } from "../components/StarterTemplateThumbnailFallback";

describe("StarterTemplateThumbnailFallback", () => {
  it("prefers the wireframe thumb SVG for a template key", () => {
    const html = renderToStaticMarkup(
      <StarterTemplateThumbnailFallback entry={{ templateKey: "tpl-home", thumbnail: undefined }} />,
    );

    expect(html.includes("/templates/previews/tpl-home-thumb.svg")).toBe(true);
  });
});
