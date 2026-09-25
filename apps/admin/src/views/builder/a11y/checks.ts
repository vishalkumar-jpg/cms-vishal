/**
 * Accessibility checker — pure functions that scan a normalized list of builder
 * nodes for WCAG/usability issues. The caller (useA11yIssues) is responsible for
 * normalizing Craft nodes + their resolved colors/text into {@link A11yNodeInfo}
 * so these checks have no Craft/DOM dependency and are unit-testable.
 *
 * Rules: contrast, missing image alt, heading order (skipped levels / multiple
 * H1), empty / low-info link text, empty buttons, missing form labels.
 */
import { contrastRatio, gradeContrast } from "./contrast";

export type Severity = "error" | "warn";

export type A11yRule =
  | "contrast"
  | "img-alt"
  | "heading-order"
  | "heading-multiple-h1"
  | "link-text"
  | "empty-button"
  | "form-label";

export interface A11yIssue {
  severity: Severity;
  rule: A11yRule;
  nodeId: string;
  message: string;
  /** Optional one-click fix hint the panel can act on. */
  fix?: A11yFix;
}

export type A11yFix =
  | { kind: "focus-field"; field: string }
  | { kind: "set-prop"; path: string; value: unknown; label: string }
  | { kind: "ai-alt" };

/**
 * Normalized view of a node for the checker. The hook fills the optional fields
 * it can resolve for the node's block type.
 */
export interface A11yNodeInfo {
  nodeId: string;
  /** Block displayName, e.g. "Heading", "Image", "Button", "Link". */
  blockName: string;
  /** Resolved foreground text color (concrete CSS value, e.g. rgb(...)). */
  textColor?: string | null;
  /** Resolved background color (nearest opaque ancestor background). */
  bgColor?: string | null;
  /** Computed font size in px (for large-text contrast thresholds). */
  fontSizePx?: number;
  bold?: boolean;
  /** Visible text content (heading/paragraph/link/button label). */
  text?: string | null;
  /** Heading level 1–6 when this is a heading. */
  headingLevel?: number | null;
  /** Image alt text (Image block). */
  alt?: string | null;
  /** True when the node is an image. */
  isImage?: boolean;
  /** True when the node is a link/anchor (has href). */
  href?: string | null;
  /** True for form input nodes that should have an associated label. */
  isFormControl?: boolean;
  /** Whether a form control has an accessible label. */
  hasLabel?: boolean;
}

const LOW_INFO_LINK = new Set([
  "click here",
  "here",
  "read more",
  "more",
  "link",
  "this",
  "click",
  "learn more",
]);

const normalize = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Contrast check for a single text-bearing node. */
const checkContrast = (n: A11yNodeInfo): A11yIssue | null => {
  const text = normalize(n.text);
  if (!text) return null;
  const ratio = contrastRatio(n.textColor, n.bgColor);
  if (ratio == null) return null; // unresolvable colors (tokens/gradients) — skip
  const grade = gradeContrast(ratio, n.fontSizePx ?? 16, n.bold ?? false);
  if (grade === "fail") {
    return {
      severity: "error",
      rule: "contrast",
      nodeId: n.nodeId,
      message: `Low contrast ${ratio.toFixed(2)}:1 (needs 4.5:1 for AA). Text may be hard to read.`,
      fix: {
        kind: "set-prop",
        path: "styles.colors.textColor",
        value: "hsl(var(--foreground))",
        label: "Use Foreground token",
      },
    };
  }
  return null;
};

const checkImage = (n: A11yNodeInfo): A11yIssue | null => {
  if (!n.isImage) return null;
  const alt = (n.alt ?? "").trim();
  if (alt.length === 0) {
    return {
      severity: "error",
      rule: "img-alt",
      nodeId: n.nodeId,
      message: "Image is missing alt text. Add a description for screen readers.",
      fix: { kind: "focus-field", field: "altText" },
    };
  }
  return null;
};

const checkLink = (n: A11yNodeInfo): A11yIssue | null => {
  if (n.href == null) return null;
  const text = normalize(n.text);
  if (!text) {
    return {
      severity: "error",
      rule: "link-text",
      nodeId: n.nodeId,
      message: "Link has no visible text. Screen readers will announce the URL.",
      fix: { kind: "focus-field", field: "text" },
    };
  }
  if (LOW_INFO_LINK.has(text)) {
    return {
      severity: "warn",
      rule: "link-text",
      nodeId: n.nodeId,
      message: `Link text "${n.text}" is not descriptive out of context.`,
      fix: { kind: "focus-field", field: "text" },
    };
  }
  return null;
};

const checkButton = (n: A11yNodeInfo): A11yIssue | null => {
  if (n.blockName !== "Button") return null;
  if (!normalize(n.text)) {
    return {
      severity: "error",
      rule: "empty-button",
      nodeId: n.nodeId,
      message: "Button has no label. Add text or an aria-label.",
      fix: { kind: "focus-field", field: "label" },
    };
  }
  return null;
};

const checkFormLabel = (n: A11yNodeInfo): A11yIssue | null => {
  if (!n.isFormControl) return null;
  if (!n.hasLabel) {
    return {
      severity: "error",
      rule: "form-label",
      nodeId: n.nodeId,
      message: "Form control has no associated label.",
      fix: { kind: "focus-field", field: "label" },
    };
  }
  return null;
};

/**
 * Heading-order check across the whole page: flags multiple H1s and skipped
 * levels (e.g. H2 → H4). Headings are read in document order as passed in.
 */
const checkHeadingOrder = (nodes: A11yNodeInfo[]): A11yIssue[] => {
  const issues: A11yIssue[] = [];
  const headings = nodes.filter((n) => typeof n.headingLevel === "number");
  let h1Count = 0;
  let prev = 0;
  for (const h of headings) {
    const level = h.headingLevel as number;
    if (level === 1) {
      h1Count += 1;
      if (h1Count > 1) {
        issues.push({
          severity: "warn",
          rule: "heading-multiple-h1",
          nodeId: h.nodeId,
          message: "Multiple H1 headings on the page. Use one H1 per page.",
        });
      }
    }
    if (prev > 0 && level > prev + 1) {
      issues.push({
        severity: "warn",
        rule: "heading-order",
        nodeId: h.nodeId,
        message: `Heading level skips from H${prev} to H${level}. Don't skip levels.`,
        fix: {
          kind: "set-prop",
          path: "level",
          value: prev + 1,
          label: `Set to H${prev + 1}`,
        },
      });
    }
    prev = level;
  }
  return issues;
};

/** Run every check over the page's nodes and return a flat issue list. */
export const runA11yChecks = (nodes: A11yNodeInfo[]): A11yIssue[] => {
  const issues: A11yIssue[] = [];
  for (const n of nodes) {
    const perNode = [
      checkContrast(n),
      checkImage(n),
      checkLink(n),
      checkButton(n),
      checkFormLabel(n),
    ];
    for (const i of perNode) if (i) issues.push(i);
  }
  issues.push(...checkHeadingOrder(nodes));
  return issues;
};

export interface A11yScore {
  /** 0–100. 100 = no issues. Errors weigh more than warnings. */
  score: number;
  errors: number;
  warnings: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

/** Derive a 0–100 score + letter grade from the issue list. */
export const scoreIssues = (issues: A11yIssue[]): A11yScore => {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warn").length;
  const penalty = errors * 12 + warnings * 4;
  const score = Math.max(0, 100 - penalty);
  const grade =
    score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 50 ? "D" : "F";
  return { score, errors, warnings, grade };
};
