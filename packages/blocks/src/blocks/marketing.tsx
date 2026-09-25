"use client";

import * as React from "react";
import { applyRootBlockStyles, applyPartStyles, SafeLink, sanitizeText, resolveSurfaceStyles, mergeVisualStyles, styleModelHasVisualOverrides } from "../lib";
import { EditableText } from "../editable-text";
import { subpartAttrs } from "../subpart";

/** Map common icon names (from the POC's icon picker) to a glyph so a CTA icon
 * renders as a symbol, not the literal name text. Unknown names render nothing. */
const ICON_GLYPHS: Record<string, string> = {
  "arrow-right": "→",
  "arrow-left": "←",
  "arrow-up": "↑",
  "arrow-down": "↓",
  "chevron-right": "›",
  "chevron-left": "‹",
  check: "✓",
  plus: "+",
  star: "★",
  play: "▶",
  external: "↗",
};
const iconGlyph = (name?: string): string =>
  (name && ICON_GLYPHS[name.toLowerCase()]) || "";

/* ---- Hero Section ------------------------------------------------ */
export const HeroSection = React.forwardRef<HTMLElement, {
  title?: string;
  subtitle?: string;
  highlightText?: string;
  highlightColor?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaStyles?: Record<string, any>;
  ctaIcon?: string;
  buttons?: Array<{ label?: string; url?: string; styles?: Record<string, any> }>;
  showCta?: boolean;
  imageUrl?: string;
  layout?: string;
  trustBadgeUrl?: string;
  trustBadgeLink?: string;
  showTrustDivider?: boolean;
  styles?: unknown;
  /** Per-part StyleModel overrides, keyed by sub-part (title/subtitle/image/cta). */
  partStyles?: Record<string, unknown>;
  children?: React.ReactNode;
}>(({
  title,
  subtitle,
  highlightText,
  highlightColor = "#147eff",
  ctaText,
  ctaUrl,
  ctaStyles = {},
  ctaIcon,
  buttons = [],
  showCta = true,
  imageUrl,
  layout = "centered",
  trustBadgeUrl,
  trustBadgeLink,
  showTrustDivider = false,
  styles,
  partStyles = {},
  children,
}, ref) => {
  const isSplit = layout === "split" && !!imageUrl;
  const resolved = applyRootBlockStyles(styles, {
    structural: { textAlign: isSplit ? "left" : "center" },
  });
  const partCss = (key: string): React.CSSProperties =>
    partStyles[key] ? applyPartStyles(partStyles[key]) : {};

  if (React.Children.count(children) > 0) {
    return (
      <section ref={ref} style={{ textAlign: isSplit ? "left" : "center", ...resolved }}>{children}</section>
    );
  }

  const ctaButtons =
    buttons.length > 0
      ? buttons
      : ctaText
        ? [{ label: ctaText, url: ctaUrl, styles: ctaStyles }]
        : [];

  const image = imageUrl ? (
    <img
      src={String(imageUrl)}
      alt={sanitizeText(title) || "Hero"}
      loading="eager"
      {...subpartAttrs("image", { label: "Image", image: "imageUrl", style: "partStyles.image" })}
      style={{ maxWidth: isSplit ? "100%" : 960, maxHeight: isSplit ? 480 : 420, borderRadius: 16, objectFit: "cover", margin: isSplit ? 0 : "48px auto 0", display: "block", width: "100%", ...partCss("image") }}
    />
  ) : null;

  return (
    <section ref={ref} style={{ textAlign: isSplit ? "left" : "center", ...resolved }}>
      <div
        className={isSplit ? "hero-split-grid cms-hero-split" : "cms-hero-centered"}
        style={{ margin: "0 auto", width: "100%", display: isSplit ? "grid" : "block", alignItems: "center", boxSizing: "border-box" }}
      >
        <div>
          <EditableText
            as="h1"
            propKey="title"
            value={title}
            highlightText={highlightText}
            highlightColor={highlightColor}
            className="cms-fluid-hero-title ob-hero-title"
            dataAttrs={subpartAttrs("title", { label: "Title", text: "title", style: "partStyles.title" })}
            style={{ margin: "0 0 16px", fontWeight: 700, ...partCss("title") }}
          />
          <EditableText
            as="p"
            propKey="subtitle"
            value={subtitle}
            className="cms-fluid-hero-subtitle ob-hero-subtitle"
            dataAttrs={subpartAttrs("description", { label: "Description", text: "subtitle", style: "partStyles.subtitle" })}
            style={{ margin: "0 0 32px", opacity: 0.9, display: "block", maxWidth: 720, marginLeft: isSplit ? 0 : "auto", marginRight: isSplit ? 0 : "auto", ...partCss("subtitle") }}
          />
          {showCta !== false && ctaButtons.length > 0 ? (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: isSplit ? "flex-start" : "center" }}>
              {ctaButtons.map((b, i) => {
                const heroBtnStructural: React.CSSProperties = {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  textDecoration: "none",
                };
                const heroBtnDefaults: React.CSSProperties = {
                  padding: "14px 28px",
                  borderRadius: 5,
                  backgroundColor: "#147eff",
                  color: "#ffffff",
                  fontWeight: 600,
                };
                const btnStyles = i === 0 ? (partStyles["cta"] ?? b.styles ?? {}) : (b.styles ?? {});
                const hasOverrides = styleModelHasVisualOverrides(btnStyles);
                const { surface: btnSurface } = resolveSurfaceStyles(
                  btnStyles,
                  mergeVisualStyles(heroBtnStructural, hasOverrides ? {} : heroBtnDefaults),
                );
                return (
                <SafeLink
                  key={i}
                  url={b.url}
                  className="ob-btn cms-fluid-btn"
                  {...(i === 0
                    ? subpartAttrs("button", {
                        label: "Button",
                        text: buttons.length > 0 ? "buttons.0.label" : "ctaText",
                        style: "partStyles.cta",
                      })
                    : {})}
                  style={btnSurface}
                >
                  {sanitizeText(b.label)}
                  {i === 0 && ctaIcon ? <span aria-hidden style={{ color: "inherit" }}>{iconGlyph(ctaIcon)}</span> : null}
                </SafeLink>
              );})}
            </div>
          ) : null}
          {showTrustDivider ? (
            <hr style={{ border: "none", borderTop: "1px solid rgba(108, 124, 147, 0.2)", margin: "32px 0 24px" }} />
          ) : null}
          {trustBadgeUrl ? (
            <SafeLink url={trustBadgeLink || "#"} style={{ display: "inline-block" }}>
              <img src={String(trustBadgeUrl)} alt="Trust badge" style={{ maxWidth: 200, height: "auto", display: "block" }} loading="lazy" />
            </SafeLink>
          ) : null}
        </div>
        {isSplit ? image : null}
      </div>
      {!isSplit ? image : null}
    </section>
  );
});
HeroSection.displayName = "Hero Section";

/* ---- Feature List ----------------------------------------------- */
interface Feature {
  title?: string;
  description?: string;
  icon?: string;
  url?: string;
}

export const FeatureList = React.forwardRef<
  HTMLDivElement,
  { features?: Feature[]; columns?: number; partStyles?: Record<string, unknown>; styles?: unknown }
>(({ features = [], columns = 3, partStyles = {}, styles }, ref) => {
  const list: Feature[] = features.length
    ? features
    : [
        { title: "Fast", description: "Lightning fast performance", icon: "⚡" },
        { title: "Secure", description: "Enterprise-grade security", icon: "🔒" },
        { title: "Scalable", description: "Grows with your business", icon: "📈" },
      ];
  const gridStructural = mergeVisualStyles(
    {
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: "clamp(16px, 3vw, 24px)",
      width: "100%",
    },
    partStyles.grid ? applyPartStyles(partStyles.grid) : {},
  );
  return (
    <div
      ref={ref}
      className="cms-feature-grid"
      data-columns={columns}
      style={applyRootBlockStyles(styles, {
        structural: gridStructural,
      })}
    >
      {list.map((f, i) => {
        const title = (
          <h3 className="ob-feature-card__title" style={{ margin: "0 0 8px", display: "block" }}>
            {sanitizeText(f.title)}
          </h3>
        );
        const iconIsImg = typeof f.icon === "string" && f.icon.startsWith("http");
        return (
          <article key={i} className="ob-feature-card">
            <div className="ob-feature-card__icon">
              {iconIsImg ? (
                <img src={String(f.icon)} alt="" className="ob-feature-card__icon-img" loading="lazy" />
              ) : (
                <span>{sanitizeText(f.icon)}</span>
              )}
            </div>
            {f.url ? (
              <SafeLink url={f.url} style={{ textDecoration: "none", color: "inherit" }}>
                {title}
              </SafeLink>
            ) : (
              title
            )}
            <p className="ob-feature-card__text" style={{ margin: 0, lineHeight: 1.6, display: "block" }}>
              {sanitizeText(f.description)}
            </p>
          </article>
        );
      })}
    </div>
  );
});
FeatureList.displayName = "Feature List";

/* ---- Counter Section (animation enhanced on mount only) --------- */
interface Stat {
  value?: string;
  label?: string;
  description?: string;
}

const parseCounterValue = (raw: unknown) => {
  const str = String(raw ?? "");
  const match = str.match(/^([\d,]+)(.*)$/);
  if (!match) return { num: null as number | null, suffix: str };
  const num = parseInt(match[1].replace(/,/g, ""), 10);
  return { num: Number.isNaN(num) ? null : num, suffix: match[2] || "" };
};

const AnimatedCounter: React.FC<{ value?: string; animate: boolean; duration: number }> = ({
  value,
  animate,
  duration,
}) => {
  const parsed = parseCounterValue(value);
  // Render the final value on the server and on first client paint to keep
  // markup deterministic; only run the count-up animation after mount.
  const [shown, setShown] = React.useState<string>(value ?? "");
  React.useEffect(() => {
    if (!animate || parsed.num == null || typeof window === "undefined") {
      setShown(value ?? "");
      return;
    }
    let frame = 0;
    let start = 0;
    setShown(`0${parsed.suffix}`);
    const run = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setShown(`${Math.round((parsed.num as number) * p).toLocaleString()}${parsed.suffix}`);
      if (p < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [animate, duration, value]);
  return <span>{sanitizeText(shown)}</span>;
};

const defaultCounterValueStyle: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 700,
  color: "inherit",
  display: "block",
  lineHeight: 1.1,
};
const defaultCounterLabelStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginTop: 8,
  display: "block",
};
const defaultCounterDescriptionStyle: React.CSSProperties = {
  fontSize: 14,
  margin: "12px 0 0",
  opacity: 0.9,
  lineHeight: 1.6,
  display: "block",
};

export const CounterSection = React.forwardRef<HTMLElement, {
  stats?: Stat[];
  columns?: number;
  cardStyle?: boolean;
  animate?: boolean;
  animateDuration?: number;
  partStyles?: Record<string, unknown>;
  styles?: unknown;
}>(({ stats = [], columns = 3, cardStyle = true, animate = false, animateDuration = 2000, partStyles = {}, styles }, ref) => {
  const list: Stat[] = stats.length
    ? stats
    : [
        { value: "40%", label: "Avg. Cost Savings", description: "Reduce overhead without sacrificing quality." },
        { value: "24/7", label: "Global Coverage", description: "Teams across time zones for round-the-clock support." },
        { value: "4,000+", label: "Businesses Served", description: "Trusted by companies worldwide since 1998." },
      ];
  const valueStyle = mergeVisualStyles(
    defaultCounterValueStyle,
    partStyles.value ? applyPartStyles(partStyles.value) : {},
  );
  const labelStyle = mergeVisualStyles(
    defaultCounterLabelStyle,
    partStyles.label ? applyPartStyles(partStyles.label) : {},
  );
  const descriptionStyle = mergeVisualStyles(
    defaultCounterDescriptionStyle,
    partStyles.description ? applyPartStyles(partStyles.description) : {},
  );
  const cardPartStyle = partStyles.card ? applyPartStyles(partStyles.card) : undefined;
  const gridStyle = mergeVisualStyles(
    { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 32 },
    partStyles.grid ? applyPartStyles(partStyles.grid) : {},
  );

  return (
    <section ref={ref} className={cardStyle ? "ob-stats-section" : undefined} style={applyRootBlockStyles(styles)}>
      <div className="cms-stats-grid" style={gridStyle}>
        {list.map((s, i) => (
          <div
            key={i}
            className={cardStyle ? "ob-counter-card" : ""}
            style={mergeVisualStyles(
              cardStyle ? {} : { textAlign: "center" },
              cardPartStyle ?? {},
            )}
          >
            <div style={valueStyle}>
              <AnimatedCounter value={s.value} animate={animate} duration={animateDuration} />
            </div>
            <div style={labelStyle}>{sanitizeText(s.label)}</div>
            {s.description ? <p style={descriptionStyle}>{sanitizeText(s.description)}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
});
CounterSection.displayName = "Counter Section";

/* ---- Step Cards -------------------------------------------------- */
interface Step {
  number?: string;
  title?: string;
  description?: string;
  iconUrl?: string;
  variant?: string;
  ctaCard?: boolean;
  ctaUrl?: string;
  ctaLabel?: string;
  imageUrl?: string;
}

export const StepCards = React.forwardRef<
  HTMLElement,
  { steps?: Step[]; columns?: number; partStyles?: Record<string, unknown>; styles?: unknown }
>(({ steps = [], columns = 3, partStyles = {}, styles }, ref) => {
  const list: Step[] = steps.length
    ? steps
    : [
        { number: "1", title: "We scope and source.", description: "Understand your needs and shortlist matched candidates." },
        { number: "2", title: "We train and integrate.", description: "Onboard your team with your tools and workflows." },
        { number: "3", title: "You go live.", description: "Dedicated team starts within 5–10 business days." },
      ];
  const { surface: stepCtaSurface } = resolveSurfaceStyles({}, {
    display: "inline-flex",
    backgroundColor: "#fff",
    color: "#002244",
    padding: "14px 28px",
    borderRadius: 5,
    fontWeight: 600,
    textDecoration: "none",
  });

  const gridStyle = mergeVisualStyles(
    { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 32 },
    partStyles.grid ? applyPartStyles(partStyles.grid) : {},
  );
  const numberStyle = partStyles.number ? applyPartStyles(partStyles.number) : undefined;
  const titleStyle = mergeVisualStyles(
    { margin: "0 0 12px", display: "block" },
    partStyles.title ? applyPartStyles(partStyles.title) : {},
  );
  const descriptionStyle = mergeVisualStyles(
    { margin: 0, lineHeight: 1.6, display: "block" },
    partStyles.description ? applyPartStyles(partStyles.description) : {},
  );
  const cardShellStyle = partStyles.card ? applyPartStyles(partStyles.card) : undefined;

  return (
    <section ref={ref} style={applyRootBlockStyles(styles)}>
      <div className="cms-auto-grid ob-step-grid" style={gridStyle}>
        {list.map((s, i) => {
          if (s.variant === "ctaCard" || s.ctaCard) {
            return (
              <article key={i} className="ob-step-cta-card">
                {s.imageUrl ? <img src={String(s.imageUrl)} alt="" className="ob-step-cta-card__bg" loading="lazy" /> : null}
                <div className="ob-step-cta-card__overlay" />
                <div className="ob-step-cta-card__content">
                  <SafeLink
                    url={s.ctaUrl || "#"}
                    className="ob-btn ob-btn--white cms-fluid-btn"
                    style={stepCtaSurface}
                  >
                    {sanitizeText(s.ctaLabel) || "Learn more"}
                  </SafeLink>
                </div>
              </article>
            );
          }
          const iconIsImg = typeof s.iconUrl === "string" && s.iconUrl.startsWith("http");
          return (
            <article key={i} className="ob-step-card" style={cardShellStyle}>
              <div className="ob-step-card__num" style={numberStyle}>
                {iconIsImg ? <img src={String(s.iconUrl)} alt="" loading="lazy" /> : sanitizeText(s.number)}
              </div>
              <h3 className="ob-step-card__title" style={titleStyle}>
                {sanitizeText(s.title)}
              </h3>
              <p className="ob-step-card__text" style={descriptionStyle}>
                {sanitizeText(s.description)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
});
StepCards.displayName = "Step Cards";
