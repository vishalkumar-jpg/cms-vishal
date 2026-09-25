"use client";

import * as React from "react";
import type { PublicConsentConfig } from "@/lib/public-api-types";
import {
  dntEnabled,
  effectiveConsent,
  getConsent,
  registerConsentOpener,
  setConsent,
  type ConsentState,
} from "@/lib/consent";

/**
 * ConsentManager — the Consent Management Platform UI (Privacy & Consent suite).
 * A single "use client" component mounted once per page that renders:
 *
 *  - a first-visit BANNER (Accept all / Reject non-essential / Customize),
 *  - a PREFERENCE-CENTER with per-category toggles (necessary always on),
 *  - the re-open bridge for a "Manage cookies" footer link.
 *
 * It writes the decision to the first-party `ob_consent` cookie via lib/consent,
 * which every tracker reads before firing. SSR-safe: it renders `null` on the
 * server and until mount (no flash-of-content / hydration mismatch), then shows
 * the banner only when there is no valid decision yet.
 *
 * DNT: an auto-reject is applied silently (the banner never shows for a DNT
 * visitor) — see effectiveConsent().
 *
 * Geo `mode`: `"all"` shows the banner to everyone (the safe default). `"eu"` is
 * an IP-geo SEAM — without an edge geo header the renderer cannot know the
 * visitor's country client-side, so it currently behaves like `"all"`; the
 * documented seam is a `data-ob-geo` attribute / edge middleware header that a
 * future deployment sets to gate the banner to EU visitors. Documented in
 * apps/api/PRIVACY-CONSENT.md.
 */

export const ConsentManager: React.FC<{ config: PublicConsentConfig }> = ({ config }) => {
  const version = config.policyVersion || "1";
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false); // preference-center open
  const [banner, setBanner] = React.useState(false); // first-visit banner
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  // Post-mount: decide whether to show the banner + register the re-open bridge.
  React.useEffect(() => {
    setMounted(true);

    // DNT ⇒ persist an auto-reject once so trackers see a decision (never prompt).
    if (dntEnabled() && !getConsent(version)) {
      setConsent({ analytics: false, marketing: false }, version);
    }

    const decision = effectiveConsent(version);
    if (!decision) {
      setBanner(true);
    } else {
      setAnalytics(decision.analytics);
      setMarketing(decision.marketing);
    }

    // "Manage cookies" link (data-ob-cookie-settings) re-opens the center.
    return registerConsentOpener(() => {
      const current = getConsent(version);
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setBanner(false);
      setOpen(true);
    });
  }, [version]);

  const persist = (state: { analytics: boolean; marketing: boolean }): void => {
    const saved: ConsentState = setConsent(state, version);
    setAnalytics(saved.analytics);
    setMarketing(saved.marketing);
    setBanner(false);
    setOpen(false);
    // Best-effort proof-of-consent log (host-resolved via same-origin proxy).
    logConsent(state, version);
  };

  const acceptAll = (): void => persist({ analytics: true, marketing: true });
  const rejectAll = (): void => persist({ analytics: false, marketing: false });
  const saveCustom = (): void => persist({ analytics, marketing });

  if (!mounted || !config.enabled) return null;
  if (!banner && !open) return null;

  const accent = config.accentColor || "#111827";
  const pos = positionStyle(config.position);

  return (
    <div aria-live="polite">
      {/* Preference-center dialog takes priority over the banner. */}
      {open ? (
        <>
          <div style={overlayStyle} onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Cookie preferences" style={dialogStyle}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {config.title || "Cookie preferences"}
            </h2>
            <p style={{ marginTop: 8, fontSize: 14, color: "#4b5563", lineHeight: 1.5 }}>
              {config.message ||
                "We use cookies to run this site and, with your consent, to measure traffic and personalize your experience."}
            </p>

            <CategoryRow
              title="Strictly necessary"
              description="Required for the site to function. Always on."
              checked
              disabled
              onChange={() => undefined}
            />
            <CategoryRow
              title="Analytics"
              description={
                config.analyticsDescription ||
                "Anonymous, first-party traffic measurement (page views, performance) and A/B experiments."
              }
              checked={analytics}
              onChange={setAnalytics}
            />
            <CategoryRow
              title="Marketing"
              description={
                config.marketingDescription ||
                "Links your form submissions to your visit so we can follow up and attribute conversions."
              }
              checked={marketing}
              onChange={setMarketing}
            />

            {config.policyUrl ? (
              <p style={{ marginTop: 12, fontSize: 12 }}>
                <a href={config.policyUrl} style={{ color: accent, textDecoration: "underline" }}>
                  Read our privacy policy
                </a>
              </p>
            ) : null}

            <div style={btnRow}>
              <button type="button" style={ghostBtn} onClick={rejectAll}>
                Reject non-essential
              </button>
              <button type="button" style={ghostBtn} onClick={saveCustom}>
                Save choices
              </button>
              <button type="button" style={primaryBtn(accent)} onClick={acceptAll}>
                Accept all
              </button>
            </div>
          </div>
        </>
      ) : (
        // First-visit banner.
        <div role="dialog" aria-label="Cookie consent" style={{ ...bannerBase, ...pos }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>{config.title || "We value your privacy"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
              {config.message ||
                "We use cookies to run this site and, with your consent, to measure traffic and personalize your experience."}
              {config.policyUrl ? (
                <>
                  {" "}
                  <a href={config.policyUrl} style={{ color: accent, textDecoration: "underline" }}>
                    Learn more
                  </a>
                  .
                </>
              ) : null}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={ghostBtn} onClick={rejectAll}>
              Reject
            </button>
            <button type="button" style={ghostBtn} onClick={() => setOpen(true)}>
              Customize
            </button>
            <button type="button" style={primaryBtn(accent)} onClick={acceptAll}>
              Accept all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ title, description, checked, disabled, onChange }) => (
  <label style={rowStyle}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ marginTop: 3, width: 16, height: 16, flex: "0 0 auto" }}
    />
    <span style={{ minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{title}</span>
      <span style={{ display: "block", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        {description}
      </span>
    </span>
  </label>
);

/** Best-effort proof-of-consent beacon to the same-origin /api/consent proxy. */
function logConsent(state: { analytics: boolean; marketing: boolean }, version: string): void {
  try {
    let visitorId: string | undefined;
    try {
      visitorId = localStorage.getItem("ob_vid") ?? undefined;
    } catch {
      /* ignore */
    }
    const method = state.analytics && state.marketing ? "accept_all" : !state.analytics && !state.marketing ? "reject" : "custom";
    const body = JSON.stringify({
      analytics: state.analytics,
      marketing: state.marketing,
      method,
      policyVersion: version,
      path: window.location.pathname,
      ...(visitorId ? { visitorId } : {}),
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/consent", blob)) return;
    }
    void fetch("/api/consent", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      cache: "no-store",
    });
  } catch {
    /* best-effort — proof-of-consent must never break the UI */
  }
}

function positionStyle(position: PublicConsentConfig["position"]): React.CSSProperties {
  switch (position) {
    case "top":
      return { top: 16, left: 16, right: 16 };
    case "bottom-left":
      return { bottom: 16, left: 16, maxWidth: 460 };
    case "bottom-right":
      return { bottom: 16, right: 16, maxWidth: 460 };
    case "bottom":
    default:
      return { bottom: 16, left: 16, right: 16 };
  }
}

// ── inline styles (self-contained; no external CSS dependency) ──────────────
const bannerBase: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483000,
  display: "flex",
  gap: 16,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  background: "#fff",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
  padding: "16px 18px",
  margin: "0 auto",
  font: '400 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  zIndex: 2147483000,
};

const dialogStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483001,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(92vw, 520px)",
  maxHeight: "85vh",
  overflowY: "auto",
  background: "#fff",
  color: "#111827",
  borderRadius: 14,
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  padding: 24,
  font: '400 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "12px 0",
  borderTop: "1px solid #f3f4f6",
  cursor: "pointer",
};

const btnRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  marginTop: 20,
};

const ghostBtn: React.CSSProperties = {
  appearance: "none",
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtn = (accent: string): React.CSSProperties => ({
  appearance: "none",
  border: `1px solid ${accent}`,
  background: accent,
  color: "#fff",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
});
