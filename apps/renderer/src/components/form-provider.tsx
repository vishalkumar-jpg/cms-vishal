"use client";

import * as React from "react";
import {
  FormRenderContext,
  type FormRenderContextValue,
  type FormDef,
} from "@ob-cms/blocks/form-context";
import { hasConsent } from "@/lib/consent";

/**
 * Live form runtime for the published site. Provides the `FormRenderContext`
 * that Form blocks read:
 *  - `getForm` → `GET /api/forms/:id` (same-origin → proxied to the host-resolved
 *    public API, which keeps the tenant Host correct).
 *  - `submit`  → `POST /api/forms/:id/submit` with `{ data }` (real submission →
 *    existing forms→CRM pipeline).
 *
 * Same-origin is required because the public API resolves the tenant from the
 * Host header and the browser can only send the renderer's own host; the proxy
 * routes forward it. Client-only ("use client"); the value is stable.
 *
 * PHASE 3: the submit best-effort includes the first-party analytics `visitorId`
 * (localStorage `ob_vid`, shared with <Analytics/>). If the form has an email
 * field, the API links that email → visitorId (identity resolution) — a
 * non-invasive seam that never affects the submit result.
 *
 * CONSENT GATE (Privacy & Consent): identity resolution (email→visitor linking)
 * is a MARKETING-category activity. When the consent banner is active
 * (`consentEnabled`), the submit includes the `visitorId` ONLY if the visitor
 * granted `marketing` consent — otherwise the form still submits (necessary),
 * but WITHOUT the tracking link. When the banner is off, behaviour is unchanged.
 */

/** The first-party visitor id set by the analytics tracker (see analytics.tsx). */
const VISITOR_KEY = "ob_vid";
const readVisitorId = (): string | undefined => {
  try {
    return localStorage.getItem(VISITOR_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
export const LiveFormProvider: React.FC<{
  children: React.ReactNode;
  /** The consent banner is active for this site → require `marketing` consent. */
  consentEnabled?: boolean;
  /** Consent policy version (an older stored decision is treated as stale). */
  policyVersion?: string;
}> = ({ children, consentEnabled = false, policyVersion }) => {
  const value = React.useMemo<FormRenderContextValue>(
    () => ({
      mode: "live",
      getForm: async (formId) => {
        try {
          const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`, {
            headers: { accept: "application/json" },
          });
          if (!res.ok) return null;
          const json = (await res.json()) as { data?: FormDef };
          return json.data ?? null;
        } catch {
          return null;
        }
      },
      submit: async (formId, data) => {
        // Only attach the tracking visitorId when marketing consent allows it
        // (or when the banner isn't active at all — back-compat).
        const mayLink = !consentEnabled || hasConsent("marketing", policyVersion);
        const visitorId = mayLink ? readVisitorId() : undefined;
        const res = await fetch(
          `/api/forms/${encodeURIComponent(formId)}/submit`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ data, ...(visitorId ? { visitorId } : {}) }),
          },
        );
        const json = (await res
          .json()
          .catch(() => ({}))) as {
          data?: { ok?: boolean; successMessage?: string };
        };
        const ok = res.ok && json.data?.ok !== false;
        return { ok, message: json.data?.successMessage };
      },
    }),
    [consentEnabled, policyVersion],
  );

  return (
    <FormRenderContext.Provider value={value}>
      {children}
    </FormRenderContext.Provider>
  );
};
