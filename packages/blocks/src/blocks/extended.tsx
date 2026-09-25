"use client";

import * as React from "react";
import { applyRootBlockStyles, SafeHtml, sanitizeText, resolveSurfaceStyles, SafeLink, styleModelHasVisualOverrides } from "../lib";

/* ---- Comparison Table -------------------------------------------- */
export const ComparisonTable = React.forwardRef<
  HTMLDivElement,
  {
    title?: string;
    columns?: Array<{ label?: string }>;
    rows?: Array<{ feature?: string; values?: string[] }>;
    styles?: unknown;
  }
>(({ title = "Compare plans", columns = [{ label: "Basic" }, { label: "Pro" }], rows = [], styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-comparison" style={resolved}>
      {title ? <h3 className="ob-comparison__title">{sanitizeText(title)}</h3> : null}
      <div className="ob-comparison__scroll">
        <table className="ob-comparison__table">
          <thead>
            <tr>
              <th>Feature</th>
              {columns.map((c, i) => (
                <th key={i}>{sanitizeText(c.label) || `Plan ${i + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td>{sanitizeText(row.feature)}</td>
                {(row.values ?? []).map((v, vi) => (
                  <td key={vi}>{sanitizeText(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
ComparisonTable.displayName = "Comparison Table";

/* ---- Before / After ------------------------------------------------ */
export const BeforeAfter = React.forwardRef<
  HTMLDivElement,
  { beforeUrl?: string; afterUrl?: string; label?: string; styles?: unknown }
>(({ beforeUrl, afterUrl, label = "Drag to compare", styles }, ref) => {
  const [pos, setPos] = React.useState(50);
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-before-after" style={resolved}>
      <div className="ob-before-after__wrap">
        {afterUrl ? <img src={afterUrl} alt="After" className="ob-before-after__img" /> : null}
        <div className="ob-before-after__before" style={{ width: `${pos}%` }}>
          {beforeUrl ? <img src={beforeUrl} alt="Before" className="ob-before-after__img" /> : null}
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="ob-before-after__slider"
          aria-label={label}
        />
      </div>
      <p className="ob-before-after__hint">{sanitizeText(label)}</p>
    </div>
  );
});
BeforeAfter.displayName = "Before / After";

/* ---- Masonry Gallery --------------------------------------------- */
export const MasonryGallery = React.forwardRef<
  HTMLDivElement,
  { images?: Array<{ url?: string; alt?: string }>; columns?: number; styles?: unknown }
>(({ images = [], columns = 3, styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div
      ref={ref}
      className="ob-masonry"
      style={{ ...resolved, columnCount: columns }}
    >
      {images.map((img, i) => (
        <figure key={i} className="ob-masonry__item">
          {img.url ? <img src={img.url} alt={sanitizeText(img.alt) || ""} loading="lazy" /> : null}
        </figure>
      ))}
    </div>
  );
});
MasonryGallery.displayName = "Masonry Gallery";

/* ---- Code Block -------------------------------------------------- */
export const CodeBlock = React.forwardRef<
  HTMLPreElement,
  { code?: string; language?: string; styles?: unknown }
>(({ code = "", language = "text", styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <pre ref={ref} className="ob-code-block" style={resolved} data-lang={language}>
      <code>{code}</code>
    </pre>
  );
});
CodeBlock.displayName = "Code Block";

/* ---- Data Table -------------------------------------------------- */
export const DataTable = React.forwardRef<
  HTMLDivElement,
  {
    headers?: string[];
    rows?: string[][];
    styles?: unknown;
  }
>(({ headers = ["Column A", "Column B"], rows = [], styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-data-table" style={resolved}>
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{sanitizeText(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{sanitizeText(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
DataTable.displayName = "Table";

/* ---- Newsletter Signup ------------------------------------------- */
export const NewsletterSignup = React.forwardRef<
  HTMLDivElement,
  { title?: string; placeholder?: string; buttonLabel?: string; styles?: unknown }
>(({ title = "Subscribe to our newsletter", placeholder = "Your email", buttonLabel = "Subscribe", styles }, ref) => {
  const btnDefaults: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "var(--ob-brand, #0a5cd8)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  };
  const { wrapper, surface: btnSurface } = resolveSurfaceStyles(
    styles,
    styleModelHasVisualOverrides(styles) ? {} : btnDefaults,
  );
  return (
    <div ref={ref} className="ob-newsletter" style={wrapper}>
      <p className="ob-newsletter__title">{sanitizeText(title)}</p>
      <form className="ob-newsletter__form" onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder={placeholder} aria-label="Email" className="ob-newsletter__input" />
        <button type="submit" className="ob-newsletter__btn ob-btn" style={btnSurface}>
          {sanitizeText(buttonLabel)}
        </button>
      </form>
    </div>
  );
});
NewsletterSignup.displayName = "Newsletter Signup";

/* ---- Cookie Banner ----------------------------------------------- */
export const CookieBanner = React.forwardRef<
  HTMLDivElement,
  { message?: string; acceptLabel?: string; styles?: unknown }
>(({ message = "We use cookies to improve your experience.", acceptLabel = "Accept", styles }, ref) => {
  const btnDefaults: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "var(--ob-brand, #0a5cd8)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const { wrapper, surface: btnSurface } = resolveSurfaceStyles(
    styles,
    styleModelHasVisualOverrides(styles) ? {} : btnDefaults,
  );
  return (
    <div ref={ref} className="ob-cookie-banner" style={wrapper} role="dialog" aria-label="Cookie notice">
      <p>{sanitizeText(message)}</p>
      <button type="button" className="ob-cookie-banner__btn ob-btn" style={btnSurface}>
        {sanitizeText(acceptLabel)}
      </button>
    </div>
  );
});
CookieBanner.displayName = "Cookie Banner";

/* ---- Floating CTA ------------------------------------------------ */
const FLOATING_CTA_DEFAULTS: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 999,
  backgroundColor: "hsl(var(--primary))",
  color: "hsl(var(--primary-foreground))",
  fontWeight: 600,
  textDecoration: "none",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.15)",
};

export const FloatingCta = React.forwardRef<
  HTMLSpanElement,
  { label?: string; url?: string; position?: string; styles?: unknown }
>(({ label = "Get started", url = "#", position = "bottom-right", styles }, ref) => {
  const hasOverrides = styleModelHasVisualOverrides(styles);
  const { wrapper, surface } = resolveSurfaceStyles(
    styles,
    hasOverrides ? {} : FLOATING_CTA_DEFAULTS,
  );
  return (
    <span ref={ref} style={{ display: "inline-block", boxSizing: "border-box", ...wrapper }}>
      <SafeLink
        url={url}
        className={`ob-floating-cta ob-floating-cta--${position} ob-btn`}
        style={surface}
      >
        {sanitizeText(label)}
      </SafeLink>
    </span>
  );
});
FloatingCta.displayName = "Floating CTA";

/* ---- Lottie ------------------------------------------------------ */
export const Lottie = React.forwardRef<
  HTMLDivElement,
  { src?: string; loop?: boolean; autoplay?: boolean; styles?: unknown }
>(({ src, loop = true, autoplay = true, styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-lottie" style={resolved} aria-label="Animation">
      {src ? (
        <iframe
          src={src}
          title="Lottie animation"
          className="ob-lottie__frame"
          loading="lazy"
          allow="autoplay"
        />
      ) : (
        <div className="ob-lottie__placeholder">Add a Lottie embed URL</div>
      )}
      {!autoplay || !loop ? (
        <span className="sr-only">{`${autoplay ? "Autoplay" : "Manual"} ${loop ? "looping" : "once"}`}</span>
      ) : null}
    </div>
  );
});
Lottie.displayName = "Lottie";

/* ---- Calendar ---------------------------------------------------- */
export const Calendar = React.forwardRef<
  HTMLDivElement,
  { title?: string; events?: Array<{ date?: string; label?: string }>; styles?: unknown }
>(({ title = "Upcoming dates", events = [], styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-calendar" style={resolved}>
      <h3 className="ob-calendar__title">{sanitizeText(title)}</h3>
      <ul className="ob-calendar__list">
        {events.map((ev, i) => (
          <li key={i}>
            <time>{sanitizeText(ev.date) || "TBD"}</time>
            <span>{sanitizeText(ev.label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
Calendar.displayName = "Calendar";

/* ---- Event Timeline ---------------------------------------------- */
export const EventTimeline = React.forwardRef<
  HTMLDivElement,
  {
    title?: string;
    events?: Array<{ time?: string; title?: string; description?: string }>;
    styles?: unknown;
  }
>(({ title = "Event schedule", events = [], styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-event-timeline" style={resolved}>
      <h3 className="ob-event-timeline__title">{sanitizeText(title)}</h3>
      <ol className="ob-event-timeline__list">
        {events.map((ev, i) => (
          <li key={i}>
            <span className="ob-event-timeline__time">{sanitizeText(ev.time)}</span>
            <strong>{sanitizeText(ev.title)}</strong>
            {ev.description ? <p>{sanitizeText(ev.description)}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
});
EventTimeline.displayName = "Event Timeline";

/* ---- Stepper Form ------------------------------------------------ */
export const StepperForm = React.forwardRef<
  HTMLDivElement,
  {
    title?: string;
    steps?: Array<{ label?: string; description?: string }>;
    styles?: unknown;
  }
>(({ title = "Multi-step form", steps = [{ label: "Step 1" }, { label: "Step 2" }], styles }, ref) => {
  const [step, setStep] = React.useState(0);
  const resolved = applyRootBlockStyles(styles);
  const current = steps[step] ?? steps[0];
  return (
    <div ref={ref} className="ob-stepper-form" style={resolved}>
      <h3 className="ob-stepper-form__title">{sanitizeText(title)}</h3>
      <div className="ob-stepper-form__steps" role="tablist" aria-label="Form steps">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === step}
            className={i === step ? "is-active" : ""}
            onClick={() => setStep(i)}
          >
            {sanitizeText(s.label) || `Step ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="ob-stepper-form__panel" role="tabpanel">
        <p>{sanitizeText(current?.description) || "Fill in this step…"}</p>
        <div className="ob-stepper-form__nav">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          <button
            type="button"
            disabled={step >= steps.length - 1}
            onClick={() => setStep((s) => s + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
});
StepperForm.displayName = "Stepper Form";

/* ---- Design Frame ------------------------------------------------ */
export const DesignFrame = React.forwardRef<
  HTMLDivElement,
  { label?: string; note?: string; styles?: unknown; children?: React.ReactNode }
>(({ label = "Design frame", note, styles, children }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-design-frame" style={resolved}>
      <span className="ob-design-frame__label">{sanitizeText(label)}</span>
      {note ? <p className="ob-design-frame__note">{sanitizeText(note)}</p> : null}
      <div className="ob-design-frame__content">{children}</div>
    </div>
  );
});
DesignFrame.displayName = "Design Frame";

/* ---- Pricing Calculator ------------------------------------------ */
export const PricingCalculator = React.forwardRef<
  HTMLDivElement,
  { title?: string; basePrice?: number; perUserPrice?: number; styles?: unknown }
>(({ title = "Pricing calculator", basePrice = 29, perUserPrice = 5, styles }, ref) => {
  const [users, setUsers] = React.useState(5);
  const total = basePrice + users * perUserPrice;
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-pricing-calc" style={resolved}>
      <h3 className="ob-pricing-calc__title">{sanitizeText(title)}</h3>
      <label className="ob-pricing-calc__field">
        Team size
        <input
          type="range"
          min={1}
          max={50}
          value={users}
          onChange={(e) => setUsers(Number(e.target.value))}
          aria-valuemin={1}
          aria-valuemax={50}
          aria-valuenow={users}
        />
        <span>{users} users</span>
      </label>
      <p className="ob-pricing-calc__total">
        Estimated: <strong>${total}/mo</strong>
      </p>
    </div>
  );
});
PricingCalculator.displayName = "Pricing Calculator";

/* ---- Social Feed ------------------------------------------------- */
export const SocialFeed = React.forwardRef<
  HTMLDivElement,
  { title?: string; handle?: string; embedUrl?: string; styles?: unknown }
>(({ title = "Social feed", handle = "@yourbrand", embedUrl, styles }, ref) => {
  const resolved = applyRootBlockStyles(styles);
  return (
    <div ref={ref} className="ob-social-feed" style={resolved}>
      <h3 className="ob-social-feed__title">{sanitizeText(title)}</h3>
      <p className="ob-social-feed__handle">{sanitizeText(handle)}</p>
      {embedUrl ? (
        <iframe src={embedUrl} title="Social feed embed" className="ob-social-feed__embed" loading="lazy" />
      ) : (
        <div className="ob-social-feed__placeholder">Connect a social embed URL</div>
      )}
    </div>
  );
});
SocialFeed.displayName = "Social Feed";
