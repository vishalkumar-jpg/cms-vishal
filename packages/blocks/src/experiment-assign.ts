/**
 * Deterministic, sticky A/B variant assignment (Phase 4). PURE + framework-free
 * so the SAME function runs server-side (renderer, from an `ob_vid` cookie) and
 * client-side (the Experiment block, from `localStorage["ob_vid"]`) and yields
 * the IDENTICAL bucket for a given visitor — i.e. assignment is sticky per
 * visitor with no stored state.
 *
 * The split is weighted: each variant carries a positive integer `weight`; a
 * visitor's hash position in `[0,1)` selects the variant whose cumulative-weight
 * band contains it. Because the hash is a pure function of `visitorId +
 * experimentId`, re-computing on every request returns the same variant.
 */

export interface AssignVariant {
  key: string;
  weight: number;
}

/**
 * FNV-1a 32-bit hash → a float in `[0, 1)`. Small, dependency-free, stable across
 * runtimes (Node/Bun/browser) so server + client agree.
 */
export const hashToUnit = (input: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619, kept in 32-bit unsigned range.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0) / 0x100000000;
};

/**
 * Assign a variant deterministically. Returns the chosen variant `key`, or
 * `undefined` when there are no variants. Sticky: same `visitorId`+`experimentId`
 * always maps to the same key (given the same variant set + weights).
 */
export const assignVariant = (
  visitorId: string,
  experimentId: string,
  variants: AssignVariant[],
): string | undefined => {
  if (variants.length === 0) return undefined;
  const positive = variants.map((v) => ({ key: v.key, weight: v.weight > 0 ? v.weight : 0 }));
  const total = positive.reduce((s, v) => s + v.weight, 0);
  // No positive weights → fall back to an even split over all variants.
  if (total <= 0) {
    const idx = Math.floor(hashToUnit(`${visitorId}:${experimentId}`) * variants.length);
    return variants[Math.min(idx, variants.length - 1)]?.key;
  }
  const target = hashToUnit(`${visitorId}:${experimentId}`) * total;
  let cumulative = 0;
  for (const v of positive) {
    cumulative += v.weight;
    if (target < cumulative) return v.key;
  }
  return positive[positive.length - 1]?.key;
};
