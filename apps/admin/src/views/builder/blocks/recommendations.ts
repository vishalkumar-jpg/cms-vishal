/**
 * Rule-based "next section" recommendations.
 *
 * Given the current page's block make-up, suggest the next section(s) to add so a
 * non-technical user can follow a proven marketing-page flow:
 *
 *   Header → Hero → Features → Social proof → Testimonials → CTA → Footer
 *
 * Pure + dependency-free (no Craft imports, no AI) so it is trivially testable and
 * can be swapped for a smarter engine later. The builder passes a plain snapshot
 * of the Craft node map; we count block types and derive a few cheap heuristics.
 */

export interface RecommendedBlock {
  /** Registry `resolvedName` to insert (drag source / click-to-add). */
  block: string;
  /** Friendly section label shown to the user. */
  label: string;
  /** One-line "why add this next". */
  reason: string;
}

export interface PageSignals {
  /** resolvedName -> occurrence count across the whole tree. */
  counts: Record<string, number>;
  /** A level-1 heading exists (an atomic hero uses an h1). */
  hasH1: boolean;
  /** Number of Grids that look like a card grid (>= 3 children). */
  cardGrids: number;
  /** Total non-ROOT nodes (0 => empty page). */
  total: number;
}

/** Minimal shape of a Craft node we read (kept loose to avoid a hard dep). */
interface CraftNodeLike {
  data?: {
    type?: { resolvedName?: string } | string;
    props?: Record<string, unknown>;
    nodes?: string[];
  };
}

const typeName = (data: CraftNodeLike["data"]): string | undefined =>
  typeof data?.type === "string" ? data.type : data?.type?.resolvedName;

/** Count block types and derive heuristics from a Craft node map. */
export const computePageSignals = (
  nodes: Record<string, CraftNodeLike> | undefined | null,
): PageSignals => {
  const counts: Record<string, number> = {};
  let hasH1 = false;
  let cardGrids = 0;
  let total = 0;

  for (const id of Object.keys(nodes ?? {})) {
    if (id === "ROOT") continue;
    const data = nodes![id]?.data;
    const t = typeName(data);
    if (!t) continue;
    counts[t] = (counts[t] ?? 0) + 1;
    total += 1;
    if (t === "Heading" && Number((data?.props as { level?: unknown })?.level) === 1) hasH1 = true;
    if (t === "Grid" && (data?.nodes?.length ?? 0) >= 3) cardGrids += 1;
  }

  return { counts, hasH1, cardGrids, total };
};

interface FunnelStep {
  key: string;
  block: string;
  label: string;
  reason: string;
  /** Whether this stage of the page is already covered. */
  done: (s: PageSignals) => boolean;
}

const count = (s: PageSignals, name: string): number => s.counts[name] ?? 0;

/**
 * The canonical page funnel. Order defines the suggestion priority; each step is
 * "done" when an equivalent block (or heuristic) is already present, so we only
 * ever suggest what's genuinely missing.
 */
export const FUNNEL: FunnelStep[] = [
  {
    key: "header",
    block: "Navbar",
    label: "Navigation bar",
    reason: "Add a header so visitors can navigate your site.",
    done: (s) => count(s, "Navbar") + count(s, "Topbar") > 0,
  },
  {
    key: "hero",
    block: "Hero Section",
    label: "Hero section",
    reason: "Open with a bold headline and a clear call-to-action.",
    done: (s) => count(s, "Hero Section") > 0 || s.hasH1,
  },
  {
    key: "features",
    block: "Feature List",
    label: "Feature list",
    reason: "Explain what you offer with a row of feature cards.",
    done: (s) => count(s, "Feature List") + count(s, "Step Cards") > 0 || s.cardGrids > 0,
  },
  {
    key: "proof",
    block: "Counter Section",
    label: "Stats & counters",
    reason: "Back up your pitch with a few standout numbers.",
    done: (s) => count(s, "Counter Section") + count(s, "Logo Carousel") > 0,
  },
  {
    key: "testimonials",
    block: "Video Testimonial Carousel",
    label: "Testimonials",
    reason: "Build trust with real customer testimonials.",
    done: (s) => count(s, "Video Testimonial Carousel") + count(s, "Content Carousel") > 0,
  },
  {
    key: "cta",
    block: "Hero Section",
    label: "Call-to-action band",
    reason: "Close with a strong call-to-action before the footer.",
    done: (s) => count(s, "Hero Section") >= 2,
  },
  {
    key: "footer",
    block: "Footer",
    label: "Footer",
    reason: "Finish with a footer for links, contact and legal info.",
    done: (s) => count(s, "Footer") + count(s, "Copyright Block") > 0,
  },
];

/**
 * Return up to `max` recommended next sections: the earliest pending funnel steps,
 * de-duplicated by block (the CTA step reuses the Hero Section block).
 */
export const recommendNextBlocks = (
  signals: PageSignals,
  max = 3,
): RecommendedBlock[] => {
  const out: RecommendedBlock[] = [];
  const seen = new Set<string>();
  for (const step of FUNNEL) {
    if (step.done(signals) || seen.has(step.block)) continue;
    seen.add(step.block);
    out.push({ block: step.block, label: step.label, reason: step.reason });
    if (out.length >= max) break;
  }
  return out;
};
