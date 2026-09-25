import { describe, it, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { LinkRenderProvider, type LinkComponentType } from "../link-context";
import { SafeLink } from "../safe-link";

const MockLink: LinkComponentType = React.forwardRef(function MockLink(
  { href, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} data-mock-link={href} {...rest}>
      {children}
    </span>
  );
});

describe("SafeLink", () => {
  it("renders a plain anchor by default", () => {
    const html = renderToStaticMarkup(<SafeLink url="/how-it-works">Go</SafeLink>);
    expect(html).toContain('href="/how-it-works"');
    expect(html).not.toContain("data-mock-link");
  });

  it("uses the injected link component for internal paths", () => {
    const html = renderToStaticMarkup(
      <LinkRenderProvider linkComponent={MockLink}>
        <SafeLink url="/how-it-works">Go</SafeLink>
      </LinkRenderProvider>,
    );
    expect(html).toContain('data-mock-link="/how-it-works"');
    expect(html).not.toContain('href="/how-it-works"');
  });

  it("keeps external URLs as anchors even with a provider", () => {
    const html = renderToStaticMarkup(
      <LinkRenderProvider linkComponent={MockLink}>
        <SafeLink url="https://example.com">Out</SafeLink>
      </LinkRenderProvider>,
    );
    expect(html).toContain('href="https://example.com"');
  });

  it("keeps hash links as anchors for dropdown toggles", () => {
    const html = renderToStaticMarkup(
      <LinkRenderProvider linkComponent={MockLink}>
        <SafeLink url="#">Menu</SafeLink>
      </LinkRenderProvider>,
    );
    expect(html).toContain('href="#"');
  });
});
