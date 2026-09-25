/**
 * Lightweight, client-side SEO scoring + recommendations for the page SEO panel
 * (gap D22). Pure functions — no network. Produces a 0–100 score plus a
 * checklist of pass/warn/fail items the editor can act on as they type.
 *
 * The checks mirror common on-page SEO heuristics (Google/Lighthouse-ish):
 * title length, meta description presence + length, an OG image, a readable
 * slug, and best-effort hints for a single H1 + image alt text. They are
 * intentionally heuristic (the real H1/alt live in the layout, which we only
 * sample), so results are advisory.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id: string;
  label: string;
  status: CheckStatus;
  /** Actionable hint shown when not passing. */
  hint: string;
  /** Weight toward the 0–100 score. */
  weight: number;
}

export interface SeoScoreResult {
  score: number; // 0–100
  checks: SeoCheck[];
  passed: number;
  total: number;
}

export interface SeoScoreInput {
  title?: string;
  description?: string;
  ogImage?: string;
  slug?: string;
  /** Optional sampled signals from the page layout. */
  h1Count?: number;
  /** Number of images that are missing alt text (best-effort sample). */
  imagesMissingAlt?: number;
}

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function scoreSeo(input: SeoScoreInput): SeoScoreResult {
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const slug = (input.slug ?? "").trim();
  const checks: SeoCheck[] = [];

  // -- Title length ----------------------------------------------------------
  checks.push(
    titleCheck(title),
  );

  // -- Meta description ------------------------------------------------------
  checks.push(descriptionCheck(description));

  // -- OG image --------------------------------------------------------------
  checks.push({
    id: "og-image",
    label: "Social share image",
    status: input.ogImage ? "pass" : "warn",
    hint: "Add an OG image so links shared on social show a rich card.",
    weight: 15,
  });

  // -- Slug readability ------------------------------------------------------
  checks.push(slugCheck(slug));

  // -- Single H1 (sampled) ---------------------------------------------------
  if (input.h1Count != null) {
    const ok = input.h1Count === 1;
    checks.push({
      id: "single-h1",
      label: "Exactly one H1",
      status: ok ? "pass" : input.h1Count === 0 ? "fail" : "warn",
      hint:
        input.h1Count === 0
          ? "The page has no H1 heading — add one primary heading."
          : "The page has multiple H1s — keep a single top-level heading.",
      weight: 15,
    });
  }

  // -- Image alt text (sampled) ----------------------------------------------
  if (input.imagesMissingAlt != null) {
    const ok = input.imagesMissingAlt === 0;
    checks.push({
      id: "img-alt",
      label: "Images have alt text",
      status: ok ? "pass" : "warn",
      hint: `${input.imagesMissingAlt} image(s) are missing alt text — add descriptive alt for accessibility + SEO.`,
      weight: 10,
    });
  }

  return tally(checks);
}

function titleCheck(title: string): SeoCheck {
  let status: CheckStatus = "pass";
  let hint = "";
  if (!title) {
    status = "fail";
    hint = "Add a meta title (the clickable headline in search results).";
  } else if (title.length < TITLE_MIN) {
    status = "warn";
    hint = `Title is short (${title.length} chars) — aim for ${TITLE_MIN}–${TITLE_MAX}.`;
  } else if (title.length > TITLE_MAX) {
    status = "warn";
    hint = `Title is long (${title.length} chars) — Google truncates past ~${TITLE_MAX}.`;
  }
  return { id: "title", label: "Meta title length", status, hint, weight: 25 };
}

function descriptionCheck(description: string): SeoCheck {
  let status: CheckStatus = "pass";
  let hint = "";
  if (!description) {
    status = "fail";
    hint = "Add a meta description (the snippet under the title in search).";
  } else if (description.length < DESC_MIN) {
    status = "warn";
    hint = `Description is short (${description.length} chars) — aim for ${DESC_MIN}–${DESC_MAX}.`;
  } else if (description.length > DESC_MAX) {
    status = "warn";
    hint = `Description is long (${description.length} chars) — Google truncates past ~${DESC_MAX}.`;
  }
  return { id: "description", label: "Meta description", status, hint, weight: 25 };
}

function slugCheck(slug: string): SeoCheck {
  let status: CheckStatus = "pass";
  let hint = "";
  if (!slug || slug === "home") {
    // Home or empty slug is fine — not penalized.
    status = "pass";
  } else if (!SLUG_RE.test(slug)) {
    status = "warn";
    hint = "Use a lowercase, hyphen-separated slug (e.g. about-our-team).";
  } else if (slug.length > 60) {
    status = "warn";
    hint = "Slug is long — short, keyword-focused URLs read better.";
  }
  return { id: "slug", label: "Readable URL slug", status, hint, weight: 10 };
}

function tally(checks: SeoCheck[]): SeoScoreResult {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0) || 1;
  const earned = checks.reduce((s, c) => {
    const factor = c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0;
    return s + c.weight * factor;
  }, 0);
  const score = Math.round((earned / totalWeight) * 100);
  const passed = checks.filter((c) => c.status === "pass").length;
  return { score, checks, passed, total: checks.length };
}
