import * as React from "react";
import { applyRootBlockStyles, SafeLink, sanitizeText } from "../lib";
import { EditableText } from "../editable-text";

/* ---- Footer (canvas) -------------------------------------------- */
export const Footer = React.forwardRef<HTMLElement, { styles?: unknown; children?: React.ReactNode }>(
  ({ styles, children }, ref) => (
    <footer ref={ref} className="cms-footer" style={applyRootBlockStyles(styles)}>
      {children}
    </footer>
  ),
);
Footer.displayName = "Footer";

/* ---- Footer Columns (canvas) ------------------------------------ */
export const FooterColumns = React.forwardRef<
  HTMLDivElement,
  { columns?: number; styles?: unknown; children?: React.ReactNode }
>(({ styles, children }, ref) => (
  <div
    ref={ref}
    className="cms-footer-columns"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
      gap: "clamp(16px, 3vw, 32px)",
      ...applyRootBlockStyles(styles),
    }}
  >
    {children}
  </div>
));
FooterColumns.displayName = "Footer Columns";

/* ---- Footer Links ------------------------------------------------ */
export const FooterLinks = React.forwardRef<
  HTMLElement,
  {
    title?: string;
    links?: Array<{ label?: string; url?: string }>;
    styles?: unknown;
  }
>(({ title, links = [], styles }, ref) => {
  const items = links.length ? links : [{ label: "About", url: "#" }, { label: "Contact", url: "#" }];
  return (
    <nav ref={ref} aria-label={title ? sanitizeText(title) : undefined} style={applyRootBlockStyles(styles)}>
      {title ? (
        <h4 style={{ margin: "0 0 16px", fontSize: 14, textTransform: "uppercase", opacity: 0.7 }}>
          {sanitizeText(title)}
        </h4>
      ) : null}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((l, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <SafeLink url={l.url} style={{ color: "inherit", textDecoration: "none", opacity: 0.8 }}>
              {sanitizeText(l.label)}
            </SafeLink>
          </li>
        ))}
      </ul>
    </nav>
  );
});
FooterLinks.displayName = "Footer Links";

/* ---- Social Icons (text labels — SSR-safe, no icon lib) --------- */
const SOCIAL_GLYPH: Record<string, string> = {
  facebook: "Facebook",
  twitter: "Twitter",
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
};

export const SocialIcons = React.forwardRef<
  HTMLDivElement,
  {
    links?: Array<{ platform?: string; url?: string }>;
    styles?: unknown;
  }
>(({ links = [], styles }, ref) => {
  const items = links.length ? links : [{ platform: "twitter", url: "#" }, { platform: "linkedin", url: "#" }];
  return (
    <div ref={ref} style={{ display: "flex", gap: 16, ...applyRootBlockStyles(styles) }}>
      {items.map((l, i) => {
        const platform = (l.platform || "").toLowerCase();
        return (
          <SafeLink
            key={i}
            url={l.url}
            aria-label={platform || "social link"}
            style={{ color: "inherit", fontSize: 14, textDecoration: "none" }}
          >
            <span aria-hidden>{SOCIAL_GLYPH[platform] || platform || "•"}</span>
          </SafeLink>
        );
      })}
    </div>
  );
});
SocialIcons.displayName = "Social Icons";

/* ---- Copyright Block (SSR-safe — no Date at module load) -------- */
export const CopyrightBlock = React.forwardRef<HTMLParagraphElement, { text?: string; styles?: unknown }>(
  ({ text, styles }, ref) => {
    // Compute year at render time (not module load); deterministic enough for SSR.
    const value = text && text.trim() !== "" ? text : `© ${new Date().getFullYear()} Company. All rights reserved.`;
    return (
      <p
        ref={ref}
        style={applyRootBlockStyles(styles, {
          structural: { margin: 0 },
          defaults: { fontSize: 14, opacity: 0.6 },
        })}
      >
        <EditableText as="span" propKey="text" value={value} />
      </p>
    );
  },
);
CopyrightBlock.displayName = "Copyright Block";
