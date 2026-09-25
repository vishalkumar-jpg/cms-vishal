/**
 * Consent client runtime (Privacy & Consent suite). A tiny, dependency-free,
 * SSR-safe pub-sub over the first-party `ob_consent` cookie. It is THE gate every
 * tracker reads before it fires: no beacons, no `ob_vid`, nothing until the
 * visitor has consented to the relevant category.
 *
 * Cookie `ob_consent` (first-party, ~6mo, SameSite=Lax) holds:
 *   { analytics: boolean, marketing: boolean, ts: number, version: string }
 *
 * Categories:
 *   - necessary — always on (the site's own function). Never gated.
 *   - analytics — Phase 2 pageview/web-vitals + Phase 4 experiments + Phase 5
 *                 attribution. Gated on `analytics`.
 *   - marketing — Phase 3 identity/identify (email→visitor linking). Gated on
 *                 `marketing`.
 *
 * Stance:
 *   - Do-Not-Track ⇒ an automatic REJECT (analytics:false, marketing:false) —
 *     recorded so we never prompt a DNT visitor.
 *   - Before any decision the state is "unknown" ⇒ everything is treated as
 *     denied (necessary-only). Trackers must call `hasConsent()` which is false
 *     until a decision exists.
 *   - A new `policyVersion` (passed from site config) invalidates an older
 *     decision so the banner re-prompts.
 *
 * This module holds NO React — it's imported by the "use client" banner AND the
 * "use client" tracker components. All DOM access is guarded for SSR.
 */

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  /** Decision timestamp (ms). */
  ts: number;
  /** Policy version the decision was made under. */
  version: string;
}

export type ConsentCategory = "analytics" | "marketing";

const COOKIE = "ob_consent";
const MAX_AGE = 60 * 60 * 24 * 182; // ~6 months

type Listener = (state: ConsentState | null) => void;
const listeners = new Set<Listener>();

/** Read the raw cookie value (SSR-safe → null on the server). */
function readCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") {
      return null;
    }
    return {
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
      version: typeof parsed.version === "string" ? parsed.version : "1",
    };
  } catch {
    return null;
  }
}

/** Do-Not-Track — an explicit privacy signal we honor as an auto-reject. */
export function dntEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

/**
 * The current decision, or `null` if none has been made yet. A stored decision
 * under an OLDER policy version than `requiredVersion` is treated as stale
 * (returns null) so the banner re-prompts.
 */
export function getConsent(requiredVersion?: string): ConsentState | null {
  const state = readCookie();
  if (!state) return null;
  if (requiredVersion && state.version !== requiredVersion) return null;
  return state;
}

/** True when the given category is allowed by the current decision. */
export function hasConsent(category: ConsentCategory, requiredVersion?: string): boolean {
  const state = getConsent(requiredVersion);
  return !!state && state[category] === true;
}

/** Persist a decision to the cookie + notify all trackers/subscribers. */
export function setConsent(
  next: { analytics: boolean; marketing: boolean },
  version = "1",
): ConsentState {
  const state: ConsentState = {
    analytics: !!next.analytics,
    marketing: !!next.marketing,
    ts: Date.now(),
    version,
  };
  if (typeof document !== "undefined") {
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${COOKIE}=${encodeURIComponent(
        JSON.stringify(state),
      )}; path=/; max-age=${MAX_AGE}; SameSite=Lax${secure}`;
    } catch {
      /* best-effort */
    }
  }
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      /* isolate a bad subscriber */
    }
  }
  return state;
}

/**
 * Subscribe to consent changes. Fires immediately with the current state, then
 * on every `setConsent`. Returns an unsubscribe. Trackers use this to START when
 * a visitor later accepts (re-check on change).
 */
export function onConsentChange(listener: Listener): () => void {
  listeners.add(listener);
  try {
    listener(getConsent());
  } catch {
    /* ignore */
  }
  return () => listeners.delete(listener);
}

/**
 * Resolve the effective decision for gating, applying DNT. Returns:
 *   - a stored decision if present (respecting policy version),
 *   - a synthetic all-false when DNT is on (auto-reject, never prompts),
 *   - null when there is genuinely no decision yet (⇒ show the banner).
 */
export function effectiveConsent(requiredVersion?: string): ConsentState | null {
  const stored = getConsent(requiredVersion);
  if (stored) return stored;
  if (dntEnabled()) {
    return { analytics: false, marketing: false, ts: Date.now(), version: requiredVersion ?? "1" };
  }
  return null;
}

// ── "Manage cookies" re-open bridge ─────────────────────────────────────────
// The footer link is a plain server-rendered anchor with `data-ob-cookie-settings`
// (SSR-safe, no client needed). The client banner registers an opener here + a
// delegated click listener so the link re-opens the preference-center.

type Opener = () => void;
let opener: Opener | null = null;
let clickBound = false;

export function registerConsentOpener(fn: Opener): () => void {
  opener = fn;
  if (typeof document !== "undefined" && !clickBound) {
    clickBound = true;
    document.addEventListener("click", (e) => {
      const el = (e.target as Element | null)?.closest?.("[data-ob-cookie-settings]");
      if (el) {
        e.preventDefault();
        opener?.();
      }
    });
  }
  return () => {
    if (opener === fn) opener = null;
  };
}

/** Programmatic re-open (used by a floating button / external callers). */
export function openConsentPreferences(): void {
  opener?.();
}
