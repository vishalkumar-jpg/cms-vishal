"use client";

import * as React from "react";
import { hasConsent, onConsentChange } from "@/lib/consent";

/**
 * ExperimentGoals — the Phase 4 A/B conversion tracker (mounted once per page,
 * alongside <Analytics/>). It reads the visitor's active experiment assignments
 * (written by the Experiment block into `localStorage["ob_ab"]` on exposure) and
 * fires a `conversion` beacon when a goal is met:
 *
 *  - `pageview`   — the current path matches the experiment's `goalPath`.
 *  - `click`      — a click bubbles from an element marked `data-ab-goal` (or
 *                   `[data-ab-goal="<experimentId>"]` to scope to one experiment).
 *  - `form_submit`— any form submit on the page (or a form marked `data-ab-goal`).
 *
 * A conversion is recorded at most once per (experiment, visitor, session) via a
 * localStorage guard so repeat goals don't inflate the rate. SSR-safe: all logic
 * runs inside a mount effect and honors Do-Not-Track (it sends nothing then).
 *
 * CONSENT GATE (Privacy & Consent): A/B conversions are an ANALYTICS-category
 * activity. When the banner is active (`consentEnabled`), this tracker fires ONLY
 * with `analytics` consent. It is doubly safe: without consent the Analytics
 * tracker mints no `ob_vid` and the Experiment block writes no `ob_ab`, so this
 * component already no-ops — the explicit gate makes the intent unmistakable and
 * re-checks on consent change.
 */

const VISITOR_KEY = "ob_vid";
const ASSIGN_KEY = "ob_ab";
const CONVERTED_KEY = "ob_ab_conv";

interface StoredAssignment {
  variant: string;
  goalType: "pageview" | "click" | "form_submit";
  goalPath: string | null;
}

function dntEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readVisitorId(): string | null {
  try {
    return localStorage.getItem(VISITOR_KEY);
  } catch {
    return null;
  }
}

function sendConversion(experimentId: string, variant: string, visitorId: string, path: string): void {
  const body = JSON.stringify({
    events: [
      { type: "event", name: "conversion", path, visitorId, sessionId: visitorId, experimentId, variant },
    ],
  });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/collect", blob)) return;
    }
  } catch {
    /* fall through */
  }
  try {
    void fetch("/collect", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true, cache: "no-store" });
  } catch {
    /* best-effort */
  }
}

export const ExperimentGoals: React.FC<{
  enabled?: boolean;
  consentEnabled?: boolean;
  policyVersion?: string;
}> = ({ enabled = true, consentEnabled = false, policyVersion }) => {
  const [consentTick, setConsentTick] = React.useState(0);
  React.useEffect(() => {
    if (!consentEnabled) return;
    return onConsentChange(() => setConsentTick((n) => n + 1));
  }, [consentEnabled]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !enabled || dntEnabled()) return;
    if (consentEnabled && !hasConsent("analytics", policyVersion)) return;

    const assignments = readJson<Record<string, StoredAssignment>>(ASSIGN_KEY);
    if (!assignments || Object.keys(assignments).length === 0) return;
    const visitorId = readVisitorId();
    if (!visitorId) return;

    const converted = new Set(readJson<string[]>(CONVERTED_KEY) ?? []);
    const path = window.location.pathname || "/";

    const convert = (experimentId: string, a: StoredAssignment): void => {
      if (converted.has(experimentId)) return;
      converted.add(experimentId);
      try {
        localStorage.setItem(CONVERTED_KEY, JSON.stringify([...converted]));
      } catch {
        /* ignore */
      }
      sendConversion(experimentId, a.variant, visitorId, path);
    };

    // Pageview goals — fire immediately when the current path matches.
    for (const [experimentId, a] of Object.entries(assignments)) {
      if (a.goalType === "pageview" && a.goalPath && a.goalPath === path) {
        convert(experimentId, a);
      }
    }

    const matchScope = (el: Element | null, experimentId: string): boolean => {
      const marked = (el as HTMLElement | null)?.closest?.("[data-ab-goal]") as HTMLElement | null;
      if (!marked) return false;
      const scope = marked.getAttribute("data-ab-goal");
      return !scope || scope === "" || scope === experimentId;
    };

    const onClick = (e: MouseEvent): void => {
      const target = e.target as Element | null;
      for (const [experimentId, a] of Object.entries(assignments)) {
        if (a.goalType === "click" && matchScope(target, experimentId)) convert(experimentId, a);
      }
    };
    const onSubmit = (e: SubmitEvent): void => {
      const target = e.target as Element | null;
      for (const [experimentId, a] of Object.entries(assignments)) {
        if (a.goalType !== "form_submit") continue;
        const hasScopedMarker = document.querySelector("[data-ab-goal]");
        if (!hasScopedMarker || matchScope(target, experimentId)) convert(experimentId, a);
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [enabled, consentEnabled, policyVersion, consentTick]);

  return null;
};
