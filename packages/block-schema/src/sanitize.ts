/**
 * Isomorphic sanitization helpers (POC-AUDIT security: fix the
 * `dangerouslySetInnerHTML` XSS). Pure string functions - no DOM, no deps -
 * so they run identically on the server (SSR), in the builder, and in tests.
 *
 * `sanitizeText` is for plain-text props rendered as React children (React
 * already escapes these, but we strip control chars and escape angle brackets
 * so the value can never be interpreted as markup by any downstream consumer).
 *
 * `sanitizeHtml` is a conservative allow-list sanitizer for the few props that
 * are intentionally rendered as HTML. It removes script/style/event handlers,
 * javascript: URLs, and any tag not on the allow-list.
 *
 * `sanitizeEmbedHtml` (Gap A8) is a SUPERSET that additionally allows
 * allowlisted-host, sandboxed `<iframe>` embeds for the Embed block.
 */

/** Remove C0 control characters (keeps tab/newline/carriage-return) without an
 *  embedded control-char regex literal. */
const stripControlChars = (str: string): string => {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const isControl = code <= 0x08 || (code >= 0x0e && code <= 0x1f) || code === 0x7f;
    if (!isControl) out += str[i];
  }
  return out;
};

/** Plain text: strip control chars and escape angle brackets. */
export const sanitizeText = (input: unknown): string => {
  if (input == null) return "";
  const str = stripControlChars(String(input));
  return str.replace(/[<>]/g, (ch) => (ch === "<" ? "&lt;" : "&gt;"));
};

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "span", "a",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
};

const isSafeUrl = (url: string): boolean =>
  // Block javascript:, data:, vbscript: and similar script-capable schemes.
  !/^\s*(javascript|data|vbscript):/i.test(url);

/**
 * Conservative HTML sanitizer. Removes disallowed tags entirely (including the
 * content of script/style/embeds), strips event handlers and unsafe URLs.
 */
export const sanitizeHtml = (input: unknown): string => {
  if (input == null) return "";
  let html = stripControlChars(String(input));

  // 1. Drop entire <script>/<style>/embed blocks including their content.
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?(<\/\s*\1\s*>|$)/gi,
    "",
  );

  // 2. Walk every remaining tag; keep only allow-listed tags + safe attrs.
  html = html.replace(
    /<\/?\s*([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g,
    (match: string, rawTag: string, rawAttrs: string) => {
      const tag = String(rawTag).toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (/^<\//.test(match)) return `</${tag}>`;

      const allowed = ALLOWED_ATTRS[tag];
      let attrStr = "";
      if (allowed) {
        const attrRe =
          /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
        let m: RegExpExecArray | null;
        while ((m = attrRe.exec(rawAttrs)) !== null) {
          const name = m[1].toLowerCase();
          const value = m[3] ?? m[4] ?? m[5] ?? "";
          if (name.startsWith("on")) continue; // strip event handlers
          if (!allowed.has(name)) continue;
          if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
          attrStr += ` ${name}="${value.replace(/"/g, "&quot;")}"`;
        }
        if (
          tag === "a" &&
          /target\s*=\s*["']?_blank/i.test(attrStr) &&
          !/rel=/.test(attrStr)
        ) {
          attrStr += ' rel="noopener noreferrer"';
        }
      }
      return `<${tag}${attrStr}>`;
    },
  );

  return html;
};

/**
 * Embed-block sanitizer (Gap A8). A SUPERSET of `sanitizeHtml`'s policy that
 * additionally allows `<iframe>` embeds whose `src` host is on a curated
 * allowlist (YouTube, Vimeo, Calendly, HubSpot, Google Maps/Forms, Loom,
 * Spotify, Typeform, etc.). Allowed iframes are forced to carry a restrictive
 * `sandbox` (scripts + same-origin + popups + forms, but no top-navigation) so
 * a malicious-but-allowlisted embed cannot take over the host page. Everything
 * `sanitizeHtml` strips is still stripped here: `<script>`, `<object>`,
 * `<embed>`, `<link>`, `<meta>`, event handlers, and javascript:/data: URLs.
 *
 * Pure string logic, no DOM - identical output in the builder and SSR renderer.
 */
const EMBED_IFRAME_HOSTS: readonly string[] = [
  "youtube.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
  "calendly.com",
  "hsforms.com",
  "hsforms.net",
  "hubspot.com",
  "meetings.hubspot.com",
  "google.com",
  "maps.google.com",
  "docs.google.com",
  "forms.gle",
  "loom.com",
  "open.spotify.com",
  "spotify.com",
  "typeform.com",
  "wistia.com",
  "fast.wistia.net",
  "player.twitch.tv",
  "clips.twitch.tv",
  "soundcloud.com",
  "w.soundcloud.com",
  "codepen.io",
  "codesandbox.io",
  "airtable.com",
  "tally.so",
];

/** True when an absolute https URL's host matches (== or subdomain of) the allowlist. */
const isAllowedEmbedSrc = (url: string): boolean => {
  if (!/^https:\/\//i.test(url)) return false; // require absolute https
  // Extract host (between scheme and the next /, ?, or #).
  const rest = url.replace(/^https:\/\//i, "");
  const host = rest.split(/[/?#]/, 1)[0].toLowerCase().replace(/:\d+$/, "");
  if (!host) return false;
  return EMBED_IFRAME_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
};

const IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation";
const IFRAME_ATTRS = new Set([
  "src", "width", "height", "title", "frameborder", "allow",
  "allowfullscreen", "loading", "style", "name", "scrolling",
]);
const IFRAME_NUMERIC_OR_TOKEN = /^[\w%.\s-]*$/; // width/height/style allow-list of chars

export const sanitizeEmbedHtml = (input: unknown): string => {
  if (input == null) return "";
  let html = stripControlChars(String(input));

  // 1. Drop script/style/object/embed/link/meta blocks entirely (content too).
  //    iframes are intentionally NOT in this list - they are handled per-host below.
  html = html.replace(
    /<\s*(script|style|object|embed|link|meta)\b[\s\S]*?(<\/\s*\1\s*>|$)/gi,
    "",
  );

  // 2. Handle <iframe ...> open tags: keep ONLY allowlisted-host https srcs and
  //    force a restrictive sandbox. Each kept iframe is replaced with an opaque
  //    placeholder token (so the standard sanitizer in step 3 cannot touch it);
  //    non-allowlisted iframes are removed entirely.
  const safeIframes: string[] = [];
  html = html.replace(
    /<\s*iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/gi,
    (_match: string, rawAttrs: string) => {
      const attrRe =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m: RegExpExecArray | null;
      let src = "";
      let attrStr = "";
      while ((m = attrRe.exec(rawAttrs)) !== null) {
        const name = m[1].toLowerCase();
        const value = m[3] ?? m[4] ?? m[5] ?? "";
        if (name.startsWith("on")) continue; // strip event handlers
        if (name === "sandbox") continue; // we force our own sandbox
        if (!IFRAME_ATTRS.has(name)) continue;
        if (name === "src") {
          if (!isAllowedEmbedSrc(value)) return ""; // unknown host -> drop iframe
          src = value;
          continue;
        }
        if (
          (name === "width" || name === "height" || name === "style") &&
          !IFRAME_NUMERIC_OR_TOKEN.test(value)
        ) {
          continue;
        }
        attrStr += ` ${name}="${value.replace(/"/g, "&quot;")}"`;
      }
      if (!src) return ""; // an iframe with no (safe) src is useless/unsafe
      const frame = `<iframe src="${src.replace(/"/g, "&quot;")}" sandbox="${IFRAME_SANDBOX}"${attrStr}></iframe>`;
      safeIframes.push(frame);
      return ` zZiframeZz${safeIframes.length - 1}Zz `;
    },
  );
  // Drop the author's now-orphaned closing iframe tags (we emit our own).
  html = html.replace(/<\/\s*iframe\s*>/gi, "");

  // 3. Run the rest through the standard conservative allow-list sanitizer, then
  //    restore the already-sanitized + sandboxed iframes from their tokens.
  html = sanitizeHtml(html).replace(
    /zZiframeZz(\d+)Zz/gi,
    (_s, i) => safeIframes[Number(i)] ?? "",
  );

  return html;
};

/**
 * SVG sanitizer (rich-media: inline SVG support for the Image block).
 *
 * Allows a conservative allow-list of presentation-only SVG tags + attributes so
 * a marketer can paste/upload a vector logo or icon and have it render inline
 * (themeable via `currentColor`) WITHOUT enabling script execution. Everything
 * dangerous is stripped:
 *   - `<script>`, `<foreignObject>`, `<style>`, `<image>`, `<use>` (xlink:href
 *     can pull external/script content), animation/`<set>` elements,
 *   - every `on*` event handler,
 *   - `href`/`xlink:href` attributes (no external refs / javascript: URLs),
 *   - any tag or attribute not on the allow-list.
 *
 * Pure string logic, no DOM — identical output in the builder and the SSR
 * renderer. Returns "" when the input doesn't look like an `<svg>` document.
 */
const SVG_ALLOWED_TAGS = new Set([
  "svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon",
  "rect", "defs", "lineargradient", "radialgradient", "stop", "title", "desc",
  "clippath", "mask", "pattern", "symbol", "text", "tspan",
]);

// Presentation + geometry attributes only. No href/xlink/event handlers.
const SVG_ALLOWED_ATTRS = new Set([
  "viewbox", "xmlns", "width", "height", "fill", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
  "stroke-miterlimit", "fill-rule", "clip-rule", "fill-opacity", "stroke-opacity",
  "opacity", "d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r",
  "rx", "ry", "transform", "gradientunits", "gradienttransform", "offset",
  "stop-color", "stop-opacity", "class", "id", "preserveaspectratio",
  "clip-path", "mask", "color", "vector-effect", "text-anchor", "font-size",
  "font-family", "font-weight", "dx", "dy", "spreadmethod", "patternunits",
]);

export const sanitizeSvg = (input: unknown): string => {
  if (input == null) return "";
  let svg = stripControlChars(String(input)).trim();
  if (!/^<svg[\s>]/i.test(svg)) return ""; // must be an <svg> document

  // 1. Drop dangerous elements entirely (content included).
  svg = svg.replace(
    /<\s*(script|style|foreignobject|image|use|animate|animatemotion|animatetransform|set)\b[\s\S]*?(<\/\s*\1\s*>|\/>|$)/gi,
    "",
  );
  // 2. Strip XML/DOCTYPE/comments.
  svg = svg.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<![\s\S]*?>/g, "");

  // 3. Walk every tag; keep only allow-listed tags + safe presentation attrs.
  svg = svg.replace(
    /<\/?\s*([a-zA-Z0-9:]+)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g,
    (match: string, rawTag: string, rawAttrs: string) => {
      const tag = String(rawTag).toLowerCase();
      if (!SVG_ALLOWED_TAGS.has(tag)) return "";
      const selfClose = /\/>\s*$/.test(match);
      if (/^<\//.test(match)) return `</${tag}>`;

      let attrStr = "";
      const attrRe =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(rawAttrs)) !== null) {
        const rawName = m[1]; // preserve original casing — SVG attrs are case-SENSITIVE
        const name = rawName.toLowerCase(); // case-insensitive allow-list check only
        const value = m[3] ?? m[4] ?? m[5] ?? "";
        if (name.startsWith("on")) continue; // event handlers
        if (name === "href" || name.endsWith(":href")) continue; // no external refs
        if (!SVG_ALLOWED_ATTRS.has(name)) continue;
        if (/url\s*\(\s*['"]?\s*(javascript|data):/i.test(value)) continue;
        // Output the original-cased name so `viewBox`/`preserveAspectRatio`/
        // `gradientUnits` etc. stay valid SVG.
        attrStr += ` ${rawName}="${value.replace(/"/g, "&quot;")}"`;
      }
      return `<${tag}${attrStr}${selfClose ? " /" : ""}>`;
    },
  );

  return svg.trim();
};

/** Sanitize a URL prop (href/src) - returns "#" for unsafe values, "" empty. */
export const sanitizeUrl = (input: unknown): string => {
  if (input == null) return "";
  const str = String(input).trim();
  if (str === "") return "";
  return isSafeUrl(str) ? str : "#";
};

/**
 * Resolve a video URL (rich-media: Video block) into a provider + an embeddable
 * URL. Accepts a pasted YouTube/Vimeo watch/share link OR a direct video file
 * URL, and returns the canonical embed `src` (forced https) so the Video block
 * can render a sandboxed iframe. For a file URL the embed is "" and the provider
 * is "file". Returns provider "none" for empty/unsafe input.
 */
export interface ResolvedVideo {
  provider: "youtube" | "vimeo" | "file" | "none";
  embedUrl: string;
}

const FILE_EXT_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;

export const resolveVideoUrl = (input: unknown, forced?: string): ResolvedVideo => {
  const raw = sanitizeUrl(input);
  if (!raw || raw === "#") return { provider: "none", embedUrl: "" };

  const provider = forced && forced !== "auto" ? forced : detectVideoProvider(raw);

  if (provider === "youtube") {
    const id = youtubeId(raw);
    return id
      ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` }
      : { provider: "file", embedUrl: "" };
  }
  if (provider === "vimeo") {
    const id = vimeoId(raw);
    return id
      ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` }
      : { provider: "file", embedUrl: "" };
  }
  return { provider: "file", embedUrl: "" };
};

const detectVideoProvider = (url: string): "youtube" | "vimeo" | "file" => {
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return "file";
};

/** Extract a YouTube video id from watch/share/embed/shorts URLs. */
const youtubeId = (url: string): string | null => {
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ||
    url.match(/youtu\.be\/([\w-]{6,})/) ||
    url.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|v)\/([\w-]{6,})/);
  return m ? m[1] : null;
};

/** Extract a Vimeo numeric id from a vimeo.com link. */
const vimeoId = (url: string): string | null => {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{4,})/);
  return m ? m[1] : null;
};

/** Is this URL a direct, playable video file (by extension)? */
export const isVideoFileUrl = (input: unknown): boolean => {
  const raw = sanitizeUrl(input);
  return !!raw && raw !== "#" && FILE_EXT_RE.test(raw);
};
