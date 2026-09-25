import { describe, it, expect } from "bun:test";
import {
  sanitizeText,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeEmbedHtml,
  sanitizeSvg,
  resolveVideoUrl,
  isVideoFileUrl,
} from "../sanitize";

describe("sanitizeText", () => {
  it("escapes angle brackets so script tags cannot form", () => {
    const out = sanitizeText('<script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;");
  });
  it("returns empty for nullish", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });
});

describe("sanitizeHtml", () => {
  it("drops <script> blocks entirely", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out.toLowerCase()).not.toContain("script");
  });
  it("strips event handlers and unsafe hrefs", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)" onclick="x()">link</a>');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("onclick");
  });
  it("removes disallowed tags like <img onerror>", () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">hi');
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out.toLowerCase()).not.toContain("<img");
  });
});

describe("sanitizeEmbedHtml", () => {
  it("keeps an allowlisted YouTube iframe and forces a sandbox", () => {
    const out = sanitizeEmbedHtml(
      '<iframe src="https://www.youtube.com/embed/abc123" width="560" height="315" allowfullscreen></iframe>',
    );
    expect(out).toContain("<iframe");
    expect(out).toContain('src="https://www.youtube.com/embed/abc123"');
    expect(out).toContain('sandbox="');
    expect(out).toContain('width="560"');
  });

  it("keeps a Calendly iframe (allowlisted host)", () => {
    const out = sanitizeEmbedHtml('<iframe src="https://calendly.com/me/30min"></iframe>');
    expect(out).toContain("calendly.com/me/30min");
    expect(out).toContain("sandbox=");
  });

  it("drops an iframe from a non-allowlisted host", () => {
    const out = sanitizeEmbedHtml('<iframe src="https://evil.example.com/x"></iframe>');
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out).not.toContain("evil.example.com");
  });

  it("drops a javascript: iframe src", () => {
    const out = sanitizeEmbedHtml('<iframe src="javascript:alert(1)"></iframe>');
    expect(out).not.toContain("javascript:");
    expect(out.toLowerCase()).not.toContain("<iframe");
  });

  it("strips <script> even alongside a valid embed (no XSS leak)", () => {
    const out = sanitizeEmbedHtml(
      '<script>alert(1)</script><iframe src="https://player.vimeo.com/video/1"></iframe>',
    );
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("player.vimeo.com/video/1");
  });

  it("strips event handlers and sandbox-escape attempts on iframes", () => {
    const out = sanitizeEmbedHtml(
      '<iframe src="https://www.youtube.com/embed/x" onload="evil()" sandbox="allow-top-navigation"></iframe>',
    );
    expect(out).not.toContain("onload");
    expect(out).not.toContain("allow-top-navigation");
    expect(out).toContain("sandbox=");
  });

  it("keeps safe formatting HTML around an embed", () => {
    const out = sanitizeEmbedHtml('<p>Watch:</p><iframe src="https://www.youtube.com/embed/x"></iframe>');
    expect(out).toContain("<p>Watch:</p>");
    expect(out).toContain("<iframe");
  });

  it("returns empty for nullish input", () => {
    expect(sanitizeEmbedHtml(null)).toBe("");
    expect(sanitizeEmbedHtml(undefined)).toBe("");
  });
});

describe("sanitizeSvg", () => {
  it("keeps allow-listed svg/path geometry + presentation attrs", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 1h2"/></svg>');
    expect(out).toContain("<svg");
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain("<path");
    expect(out).toContain('d="M1 1h2"');
  });
  it("strips <script>, event handlers and href/xlink refs", () => {
    const out = sanitizeSvg(
      '<svg onload="evil()"><script>alert(1)</script><a href="javascript:x"><use xlink:href="#a"/></a><circle cx="5" cy="5" r="2"/></svg>',
    );
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("javascript");
    expect(out.toLowerCase()).not.toContain("xlink:href");
    expect(out.toLowerCase()).not.toContain("<use");
    expect(out).toContain("<circle");
  });
  it("returns empty for non-svg input", () => {
    expect(sanitizeSvg("<div>nope</div>")).toBe("");
    expect(sanitizeSvg(null)).toBe("");
  });
});

describe("resolveVideoUrl / isVideoFileUrl", () => {
  it("builds a youtube-nocookie embed from a watch link", () => {
    const r = resolveVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r.provider).toBe("youtube");
    expect(r.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
  it("builds a youtu.be embed", () => {
    expect(resolveVideoUrl("https://youtu.be/abc123xyz").embedUrl).toContain("/embed/abc123xyz");
  });
  it("builds a vimeo player embed", () => {
    const r = resolveVideoUrl("https://vimeo.com/123456789");
    expect(r.provider).toBe("vimeo");
    expect(r.embedUrl).toBe("https://player.vimeo.com/video/123456789");
  });
  it("treats a direct file URL as provider file", () => {
    expect(resolveVideoUrl("https://cdn.x.com/a.mp4").provider).toBe("file");
    expect(isVideoFileUrl("https://cdn.x.com/a.mp4")).toBe(true);
    expect(isVideoFileUrl("https://youtube.com/watch?v=x")).toBe(false);
  });
  it("returns provider none for empty/unsafe input", () => {
    expect(resolveVideoUrl("").provider).toBe("none");
    expect(resolveVideoUrl("javascript:alert(1)").provider).toBe("none");
  });
});

describe("sanitizeUrl", () => {
  it("neutralises javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
  });
  it("passes through safe URLs", () => {
    expect(sanitizeUrl("/contact")).toBe("/contact");
    expect(sanitizeUrl("https://x.com")).toBe("https://x.com");
  });
});
