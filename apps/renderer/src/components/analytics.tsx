"use client";

import * as React from "react";
import { hasConsent, onConsentChange } from "@/lib/consent";

/**
 * Analytics — a tiny, privacy-friendly first-party tracker (Phase 2a). Mounted
 * once per page (SSR-safe: it touches no browser API at module load; everything
 * runs inside a mount effect). It:
 *
 *  1. Sends a `pageview` beacon on load (and on history navigations, though the
 *     renderer is mostly full-page — the popstate/pushState hooks cover any
 *     client transitions).
 *  2. Observes Core Web Vitals (LCP, CLS, INP) via PerformanceObserver — no
 *     dependency added — and beacons each as a `web-vitals` event.
 *  3. Uses `navigator.sendBeacon` to POST batches to the SAME-ORIGIN `/collect`
 *     proxy (which forwards to the host-resolved API), so the tenant is resolved
 *     from the Host header.
 *
 * Privacy stance: honors Do-Not-Track and an optional `enabled={false}` flag →
 * it sends NOTHING. Identifiers are a random first-party `visitorId` (a
 * localStorage value, NOT a cross-site cookie) + a `sessionId` with a 30-minute
 * inactivity window. No PII is captured; paths are sent without query strings.
 *
 * CONSENT GATE (Privacy & Consent suite): when the site has the consent banner
 * enabled (`consentEnabled`), this tracker fires ONLY once the visitor has
 * granted `analytics` consent (via the `ob_consent` cookie). Before consent (or
 * on reject) it mints NO `ob_vid` and sends NO beacons. Because THIS component is
 * the ONLY writer of `ob_vid` (localStorage + cookie), gating it here also
 * silences the Experiment block + ExperimentGoals + attribution beacons, which
 * only READ `ob_vid` and no-op without it — a single master gate. It re-checks on
 * consent change, so a later Accept starts tracking. When `consentEnabled` is
 * false the tracker behaves exactly as before (DNT-only gate) — no regression.
 */

const VISITOR_KEY = "ob_vid";
const SESSION_KEY = "ob_sid";
const SESSION_TS_KEY = "ob_sid_ts";
const SESSION_WINDOW_MS = 30 * 60 * 1000;

type BeaconEvent = {
  type: "pageview" | "web-vitals" | "event";
  path: string;
  referrer?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
  visitorId: string;
  sessionId: string;
  screenW?: number;
  screenH?: number;
  deviceType?: "desktop" | "mobile" | "tablet";
  metric?: "LCP" | "CLS" | "INP";
  value?: number;
  name?: string;
};

function dntEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Mirror the visitor id into a first-party `ob_vid` cookie (SameSite=Lax, ~1y)
 * so the RSC renderer can resolve the visitor's audiences server-side for
 * `visibleIf: audience` personalization (localStorage is client-only). Purely
 * additive — it carries the SAME random id already in localStorage, no new PII.
 */
function mirrorVisitorCookie(id: string): void {
  try {
    if (typeof document === "undefined") return;
    if (document.cookie.split("; ").some((c) => c.startsWith(`${VISITOR_KEY}=`))) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${VISITOR_KEY}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax${secure}`;
  } catch {
    /* best-effort */
  }
}

/** Read (or lazily create) the first-party random visitor id. */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    mirrorVisitorCookie(id);
    return id;
  } catch {
    return randomId();
  }
}

/** Read (or roll) the session id using a 30-min inactivity window. */
function getSessionId(): string {
  try {
    const now = Date.now();
    const last = Number(localStorage.getItem(SESSION_TS_KEY) ?? "0");
    let id = localStorage.getItem(SESSION_KEY);
    if (!id || !last || now - last > SESSION_WINDOW_MS) {
      id = randomId();
      localStorage.setItem(SESSION_KEY, id);
    }
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return id;
  } catch {
    return randomId();
  }
}

function deviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|(?=.*\bAndroid\b)(?!.*\bMobile\b)/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

function currentPath(): string {
  try {
    return window.location.pathname || "/";
  } catch {
    return "/";
  }
}

function readUtm(): { source?: string; medium?: string; campaign?: string } | undefined {
  try {
    const p = new URLSearchParams(window.location.search);
    const source = p.get("utm_source") ?? undefined;
    const medium = p.get("utm_medium") ?? undefined;
    const campaign = p.get("utm_campaign") ?? undefined;
    if (!source && !medium && !campaign) return undefined;
    return { source, medium, campaign };
  } catch {
    return undefined;
  }
}

function send(events: BeaconEvent[]): void {
  if (events.length === 0) return;
  const body = JSON.stringify({ events });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/collect", blob)) return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch("/collect", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      cache: "no-store",
    });
  } catch {
    /* best-effort */
  }
}

export const Analytics: React.FC<{
  enabled?: boolean;
  /** The consent banner is active for this site → require `analytics` consent. */
  consentEnabled?: boolean;
  /** Consent policy version (an older stored decision is treated as stale). */
  policyVersion?: string;
}> = ({ enabled = true, consentEnabled = false, policyVersion }) => {
  // Bump on every consent change so the mount effect re-evaluates the gate and
  // starts tracking the moment the visitor accepts (or stops on a later reject).
  const [consentTick, setConsentTick] = React.useState(0);
  React.useEffect(() => {
    if (!consentEnabled) return;
    return onConsentChange(() => setConsentTick((n) => n + 1));
  }, [consentEnabled]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled || dntEnabled()) return;
    // CONSENT GATE — when the banner is active, require analytics consent. No
    // consent ⇒ mint no ob_vid + send nothing (necessary-only).
    if (consentEnabled && !hasConsent("analytics", policyVersion)) return;

    const visitorId = getVisitorId();

    const base = (): Pick<BeaconEvent, "visitorId" | "sessionId" | "deviceType" | "screenW" | "screenH"> => ({
      visitorId,
      sessionId: getSessionId(),
      deviceType: deviceType(),
      screenW: window.screen?.width,
      screenH: window.screen?.height,
    });

    // 1. Pageview (on load + on client navigations).
    let lastPath = "";
    const sendPageview = (): void => {
      const path = currentPath();
      if (path === lastPath) return;
      lastPath = path;
      send([
        {
          type: "pageview",
          path,
          referrer: document.referrer || undefined,
          utm: readUtm(),
          ...base(),
        },
      ]);
    };
    sendPageview();

    const onPop = (): void => sendPageview();
    window.addEventListener("popstate", onPop);
    // Patch pushState/replaceState so SPA-style transitions fire a pageview.
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
      const r = origPush.apply(this, args);
      sendPageview();
      return r;
    };
    history.replaceState = function (this: History, ...args: Parameters<History["replaceState"]>) {
      const r = origReplace.apply(this, args);
      sendPageview();
      return r;
    };

    // 2. Core Web Vitals via PerformanceObserver (no dependency).
    const observers: PerformanceObserver[] = [];
    const sendVital = (metric: "LCP" | "CLS" | "INP", value: number): void => {
      send([{ type: "web-vitals", path: currentPath(), metric, value, ...base() }]);
    };

    const flushVitals = (): void => {
      if (lcpValue > 0) sendVital("LCP", lcpValue);
      if (clsValue > 0) sendVital("CLS", Number(clsValue.toFixed(4)));
      if (inpValue > 0) sendVital("INP", inpValue);
    };

    let lcpValue = 0;
    let clsValue = 0;
    let inpValue = 0;

    const safeObserve = (
      type: string,
      cb: (entries: PerformanceEntryList) => void,
      opts?: PerformanceObserverInit,
    ): void => {
      try {
        const obs = new PerformanceObserver((list) => cb(list.getEntries()));
        obs.observe(opts ?? ({ type, buffered: true } as PerformanceObserverInit));
        observers.push(obs);
      } catch {
        /* metric unsupported in this browser — skip */
      }
    };

    if (typeof PerformanceObserver !== "undefined") {
      // LCP — keep the largest reported candidate.
      safeObserve("largest-contentful-paint", (entries) => {
        for (const e of entries) {
          const t = (e as PerformanceEntry & { renderTime?: number; startTime: number }).renderTime || e.startTime;
          if (t > lcpValue) lcpValue = t;
        }
      });
      // CLS — sum layout-shift values that weren't from recent input.
      safeObserve("layout-shift", (entries) => {
        for (const e of entries) {
          const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!ls.hadRecentInput) clsValue += ls.value;
        }
      });
      // INP approximation — the worst event-timing duration observed.
      safeObserve(
        "event",
        (entries) => {
          for (const e of entries) {
            const dur = (e as PerformanceEntry & { duration: number }).duration;
            if (dur > inpValue) inpValue = dur;
          }
        },
        { type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit,
      );
    }

    // Flush vitals when the page is hidden/unloaded (they're finalized then).
    const onHidden = (): void => {
      if (document.visibilityState === "hidden") flushVitals();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushVitals);

    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushVitals);
      history.pushState = origPush;
      history.replaceState = origReplace;
      for (const o of observers) {
        try {
          o.disconnect();
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled, consentEnabled, policyVersion, consentTick]);

  return null;
};
