import { fixRuleIds, type AutoFix } from "./types";
import { imageDimensionsFix } from "./fixes/image-dimensions.fix";
import { lazyLoadingFix } from "./fixes/lazy-loading.fix";
import { fontDisplayFix } from "./fixes/font-display.fix";
import { imageOptimizationFix } from "./fixes/image-optimization.fix";

/**
 * The auto-fix registry. Add a new fix module here to extend the engine — the
 * service + UI iterate this list, so no other code needs to change.
 */
export const AUTO_FIXES: readonly AutoFix[] = [
  imageDimensionsFix,
  lazyLoadingFix,
  fontDisplayFix,
  imageOptimizationFix,
];

// A fix may resolve several Lighthouse rules (see `AutoFix.ruleIds`), so every
// id it responds to maps back to it. Duplicate registrations throw at load so
// silent Map overwrites can't hide conflicting modules.
const BY_RULE = new Map<string, AutoFix>();
for (const f of AUTO_FIXES) {
  for (const id of fixRuleIds(f)) {
    const existing = BY_RULE.get(id);
    if (existing && existing !== f) {
      throw new Error(`Duplicate auto-fix registration for Lighthouse rule "${id}"`);
    }
    BY_RULE.set(id, f);
  }
}

/** Look up a single fix by any Lighthouse rule id it responds to (null if unknown). */
export const getFix = (ruleId: string): AutoFix | null => BY_RULE.get(ruleId) ?? null;

/**
 * The fixes whose rule id(s) match a recommendation captured on the audit —
 * i.e. only offer fixes Lighthouse actually flagged for this page. A fix that
 * responds to several rules is returned once.
 */
export const applicableFixes = (recommendationIds: Iterable<string>): AutoFix[] => {
  const ids = new Set(recommendationIds);
  return AUTO_FIXES.filter((f) => fixRuleIds(f).some((id) => ids.has(id)));
};
