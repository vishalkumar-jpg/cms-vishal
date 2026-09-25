"use client";

import * as React from "react";
import {
  applyRootBlockStyles,
  applyPartStyles,
  mergeVisualStyles,
  sanitizeText,
  SafeLink,
  useMounted,
  resolveSurfaceStyles,
  styleModelHasVisualOverrides,
} from "../lib";

/**
 * Showcase blocks — prop-driven, SSR-safe marketing/media sections. Each takes a
 * typed array of items so the builder's auto property panel renders a friendly
 * add/remove/reorder row editor (no JSON typing needed).
 */

const splitList = (v: string | undefined): string[] =>
  (v || "")
    .split(/\r?\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);

/* ---- Pricing Table ----------------------------------------------- */
interface Plan {
  name?: string;
  price?: string;
  period?: string;
  featuresText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  featured?: boolean;
}
export const PricingTable = React.forwardRef<HTMLDivElement, { plans?: Plan[]; styles?: unknown }>(
  ({ plans = [], styles }, ref) => {
    const list = plans.length
      ? plans
      : [{ name: "Starter", price: "$0", period: "/mo", featuresText: "1 site | Basic support" }];
    const ctaDefaults: React.CSSProperties = {
      display: "inline-block",
      textAlign: "center",
      padding: "12px 20px",
      borderRadius: 8,
      backgroundColor: "var(--ob-brand, #0a5cd8)",
      color: "#fff",
      fontWeight: 600,
      textDecoration: "none",
    };
    const { wrapper, surface: ctaSurface } = resolveSurfaceStyles(
      styles,
      styleModelHasVisualOverrides(styles) ? {} : ctaDefaults,
    );
    return (
      <div
        ref={ref}
        className="ob-pricing"
        style={{ display: "grid", gridTemplateColumns: `repeat(${list.length}, minmax(0,1fr))`, gap: 24, ...wrapper }}
      >
        {list.map((p, i) => (
          <div key={i} className={`ob-pricing__card${p.featured ? " ob-pricing__card--featured" : ""}`}>
            <div className="ob-pricing__name">{sanitizeText(p.name)}</div>
            <div className="ob-pricing__price">
              <span className="ob-pricing__amount">{sanitizeText(p.price)}</span>
              <span className="ob-pricing__period">{sanitizeText(p.period)}</span>
            </div>
            <ul className="ob-pricing__features">
              {splitList(p.featuresText).map((f, fi) => (
                <li key={fi}>{sanitizeText(f)}</li>
              ))}
            </ul>
            {p.ctaLabel ? (
              <SafeLink url={p.ctaUrl || "#"} className="ob-pricing__cta ob-btn" style={ctaSurface}>
                {sanitizeText(p.ctaLabel)}
              </SafeLink>
            ) : null}
          </div>
        ))}
      </div>
    );
  },
);
PricingTable.displayName = "Pricing Table";

/* ---- Team Grid --------------------------------------------------- */
interface Member {
  name?: string;
  role?: string;
  photo?: string;
  bio?: string;
}
export const TeamGrid = React.forwardRef<
  HTMLDivElement,
  { members?: Member[]; columns?: number; styles?: unknown }
>(({ members = [], columns = 3, styles }, ref) => {
  const list = members.length ? members : [{ name: "Jane Doe", role: "Founder" }];
  return (
    <div
      ref={ref}
      className="ob-team"
      style={applyRootBlockStyles(styles, {
        structural: { display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 24 },
      })}
    >
      {list.map((m, i) => (
        <div key={i} className="ob-team__card">
          {m.photo ? <img className="ob-team__photo" src={String(m.photo)} alt={sanitizeText(m.name)} loading="lazy" /> : null}
          <div className="ob-team__name">{sanitizeText(m.name)}</div>
          <div className="ob-team__role">{sanitizeText(m.role)}</div>
          {m.bio ? <p className="ob-team__bio">{sanitizeText(m.bio)}</p> : null}
        </div>
      ))}
    </div>
  );
});
TeamGrid.displayName = "Team Grid";

/* ---- Timeline ---------------------------------------------------- */
interface TimelineEvent {
  date?: string;
  title?: string;
  description?: string;
}
export const Timeline = React.forwardRef<HTMLDivElement, { events?: TimelineEvent[]; styles?: unknown }>(
  ({ events = [], styles }, ref) => {
    const list = events.length ? events : [{ date: "2024", title: "Milestone", description: "What happened." }];
    return (
      <div ref={ref} className="ob-timeline" style={applyRootBlockStyles(styles)}>
        {list.map((e, i) => (
          <div key={i} className="ob-timeline__item">
            <div className="ob-timeline__marker" aria-hidden />
            <div className="ob-timeline__content">
              <div className="ob-timeline__date">{sanitizeText(e.date)}</div>
              <div className="ob-timeline__title">{sanitizeText(e.title)}</div>
              {e.description ? <p className="ob-timeline__desc">{sanitizeText(e.description)}</p> : null}
            </div>
          </div>
        ))}
      </div>
    );
  },
);
Timeline.displayName = "Timeline";

/* ---- Gallery (grid + lightbox) ----------------------------------- */
interface GalleryImage {
  imageUrl?: string;
  caption?: string;
}
export const Gallery = React.forwardRef<
  HTMLDivElement,
  {
    images?: GalleryImage[];
    columns?: number;
    lightbox?: boolean;
    partStyles?: Record<string, unknown>;
    styles?: unknown;
  }
>(({ images = [], columns = 3, lightbox = true, partStyles = {}, styles }, ref) => {
  const list = images.length ? images : [{ imageUrl: "", caption: "" }];
  const mounted = useMounted();
  const [open, setOpen] = React.useState<number | null>(null);
  const gridStyle = mergeVisualStyles(
    { display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12 },
    partStyles.grid ? applyPartStyles(partStyles.grid) : {},
  );
  return (
    <div ref={ref} className="ob-gallery" style={applyRootBlockStyles(styles)}>
      <div className="ob-gallery__grid" style={gridStyle}>
        {list.map((img, i) => (
          <figure key={i} className="ob-gallery__item">
            {img.imageUrl ? (
              <img
                src={String(img.imageUrl)}
                alt={sanitizeText(img.caption)}
                loading="lazy"
                onClick={() => mounted && lightbox && setOpen(i)}
                style={{ cursor: mounted && lightbox ? "zoom-in" : "default" }}
              />
            ) : (
              <div className="ob-gallery__placeholder" />
            )}
            {img.caption ? <figcaption>{sanitizeText(img.caption)}</figcaption> : null}
          </figure>
        ))}
      </div>
      {mounted && lightbox && open != null && list[open]?.imageUrl ? (
        <div className="ob-gallery__lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <img src={String(list[open].imageUrl)} alt={sanitizeText(list[open].caption)} />
        </div>
      ) : null}
    </div>
  );
});
Gallery.displayName = "Gallery";

/* ---- Map --------------------------------------------------------- */
/** Embeds a Google Maps location from a plain address (no code/iframe needed). */
export const MapEmbed = React.forwardRef<
  HTMLDivElement,
  { address?: string; embedUrl?: string; height?: number; styles?: unknown }
>(({ address = "", embedUrl = "", height = 360, styles }, ref) => {
  const src = embedUrl
    ? embedUrl
    : address
      ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
      : "";
  return (
    <div ref={ref} className="ob-map" style={applyRootBlockStyles(styles, { structural: { width: "100%" } })}>
      {src ? (
        <iframe
          title={address || "Map"}
          src={src}
          style={{ width: "100%", height, border: 0, borderRadius: 8 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="ob-map__placeholder" style={{ height }}>
          Add an address to show the map
        </div>
      )}
    </div>
  );
});
MapEmbed.displayName = "Map";
