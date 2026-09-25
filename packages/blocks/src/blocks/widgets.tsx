"use client";

import * as React from "react";
import { applyRootBlockStyles, SafeHtml } from "../lib";
import { BlockEditingContext } from "../editable-text";

/* ---- Rich Text (formatted HTML content) -------------------------- */

export const RichText = React.forwardRef<
  HTMLDivElement,
  { html?: string; styles?: unknown }
>(({ html = "", styles }, ref) => {
  const ctx = React.useContext(BlockEditingContext);
  const innerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = innerRef.current;
    if (!ctx?.editing || !el) return;
    const clean = html ?? "";
    if (el.innerHTML !== clean) el.innerHTML = clean;
  }, [ctx?.editing, html]);

  const onBlur = React.useCallback(() => {
    const el = innerRef.current;
    if (!el || !ctx) return;
    const next = el.innerHTML;
    if (next !== (html ?? "")) ctx.commit("html", next);
  }, [ctx, html]);

  if (ctx?.editing) {
    return (
      <div ref={ref} style={applyRootBlockStyles(styles)} className="ob-rich-text">
        <div
          ref={innerRef}
          className="ob-rich-text__body min-h-[4rem] outline-none"
          contentEditable
          suppressContentEditableWarning
          onBlur={onBlur}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div ref={ref} style={applyRootBlockStyles(styles)} className="ob-rich-text">
      <SafeHtml html={html} className="ob-rich-text__body" />
    </div>
  );
});
RichText.displayName = "RichText";

/* ---- Countdown timer --------------------------------------------- */

export const Countdown = React.forwardRef<
  HTMLDivElement,
  {
    targetDate?: string;
    label?: string;
    showDays?: boolean;
    styles?: unknown;
  }
>(({ targetDate, label = "Event starts in", showDays = true, styles }, ref) => {
  const [left, setLeft] = React.useState({ d: 0, h: 0, m: 0, s: 0 });
  const target = targetDate ? new Date(targetDate).getTime() : Date.now() + 86400000 * 7;

  React.useEffect(() => {
    const tick = (): void => {
      const diff = Math.max(0, target - Date.now());
      setLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const unit = (n: number, l: string): React.ReactNode => (
    <span className="ob-countdown__unit">
      <strong>{String(n).padStart(2, "0")}</strong>
      <small>{l}</small>
    </span>
  );

  return (
    <div ref={ref} style={applyRootBlockStyles(styles)} className="ob-countdown">
      {label ? <p className="ob-countdown__label">{label}</p> : null}
      <div className="ob-countdown__digits">
        {showDays ? unit(left.d, "Days") : null}
        {unit(left.h, "Hours")}
        {unit(left.m, "Min")}
        {unit(left.s, "Sec")}
      </div>
    </div>
  );
});
Countdown.displayName = "Countdown";

/* ---- Progress bar ------------------------------------------------ */

export const ProgressBar = React.forwardRef<
  HTMLDivElement,
  {
    value?: number;
    max?: number;
    label?: string;
    showLabel?: boolean;
    styles?: unknown;
  }
>(({ value = 65, max = 100, label = "Progress", showLabel = true, styles }, ref) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div ref={ref} style={applyRootBlockStyles(styles)} className="ob-progress">
      {showLabel ? (
        <div className="ob-progress__header">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div className="ob-progress__track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="ob-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
});
ProgressBar.displayName = "ProgressBar";
