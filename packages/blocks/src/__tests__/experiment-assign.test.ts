import { describe, it, expect } from "bun:test";
import { assignVariant, hashToUnit, type AssignVariant } from "../experiment-assign";

/**
 * Deterministic, sticky A/B assignment — the contract both the server (renderer,
 * from an `ob_vid` cookie) and the client (Experiment block, from localStorage)
 * rely on. Same visitor + experiment → same variant, always.
 */

const variants: AssignVariant[] = [
  { key: "A", weight: 1 },
  { key: "B", weight: 1 },
];

describe("hashToUnit", () => {
  it("is deterministic and in [0,1)", () => {
    const a = hashToUnit("visitor-1:exp-1");
    const b = hashToUnit("visitor-1:exp-1");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it("differs across inputs", () => {
    expect(hashToUnit("v1:e1")).not.toBe(hashToUnit("v2:e1"));
  });
});

describe("assignVariant", () => {
  it("is sticky: the same visitor+experiment always maps to the same variant", () => {
    const first = assignVariant("visitor-42", "exp-1", variants);
    for (let i = 0; i < 20; i++) {
      expect(assignVariant("visitor-42", "exp-1", variants)).toBe(first);
    }
  });

  it("returns a valid variant key", () => {
    const key = assignVariant("visitor-7", "exp-1", variants);
    expect(["A", "B"]).toContain(key);
  });

  it("respects weights — a 0-weight arm is (almost) never chosen", () => {
    const weighted: AssignVariant[] = [
      { key: "A", weight: 99 },
      { key: "B", weight: 1 },
    ];
    let bCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (assignVariant(`visitor-${i}`, "exp-w", weighted) === "B") bCount++;
    }
    // ~1% expected; assert well under the even-split baseline.
    expect(bCount).toBeLessThan(150);
    expect(bCount).toBeGreaterThan(0);
  });

  it("distributes roughly evenly over many visitors for equal weights", () => {
    let aCount = 0;
    for (let i = 0; i < 2000; i++) {
      if (assignVariant(`visitor-${i}`, "exp-even", variants) === "A") aCount++;
    }
    // Expect ~1000; allow a generous band.
    expect(aCount).toBeGreaterThan(800);
    expect(aCount).toBeLessThan(1200);
  });

  it("returns undefined for an empty variant set", () => {
    expect(assignVariant("v", "e", [])).toBeUndefined();
  });
});
