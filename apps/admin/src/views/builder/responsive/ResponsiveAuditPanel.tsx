import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useEditorUiStore } from "../store/editorUiStore";
import { useResponsiveAudit, type ResponsiveIssue } from "./useResponsiveAudit";

/** Set a dot-pathed value on a props object (creates intermediate objects). */
const setNested = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
};

/**
 * Responsive Audit panel — lists mobile-readiness issues for the whole page
 * (fixed widths, overflow, unreadable fonts) with one-click fixes and a
 * "Fix all" button that applies every available correction at once. Fixes write
 * per-breakpoint overrides into each node's StyleModel (`styles.responsive.*`),
 * which autosave then persists. Mirrors the A11y panel's UX.
 */
export const ResponsiveAuditPanel: React.FC = () => {
  const { issues, errors, warnings } = useResponsiveAudit();
  const { actions } = useEditor();
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const setBreakpoint = useEditorUiStore((s) => s.setBreakpoint);

  const fixable = issues.filter((i) => i.fix);

  const applyOne = (issue: ResponsiveIssue): void => {
    if (!issue.fix) return;
    try {
      actions.setProp(issue.nodeId, (props: Record<string, unknown>) => {
        setNested(props, issue.fix!.path, issue.fix!.value);
      });
    } catch {
      /* node removed mid-edit */
    }
  };

  const fixAll = (): void => {
    for (const issue of fixable) applyOne(issue);
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      {/* Summary */}
      <div
        className={`flex items-center justify-between rounded-md px-3 py-2 ${
          errors > 0
            ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200"
            : warnings > 0
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        }`}
      >
        <div>
          <p className="text-[11px] uppercase tracking-wide opacity-70">Mobile readiness</p>
          <p className="text-sm font-bold leading-tight">
            {issues.length === 0 ? "Looks great" : `${issues.length} issue${issues.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="text-right text-[11px]">
          <p>{errors} to fix</p>
          <p>{warnings} suggestions</p>
        </div>
      </div>

      {breakpoint !== "mobile" && (
        <button
          type="button"
          onClick={() => setBreakpoint("mobile")}
          className="flex items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Switch to mobile view for the most accurate check
        </button>
      )}

      {fixable.length > 0 && (
        <button
          type="button"
          onClick={fixAll}
          className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          Fix all ({fixable.length})
        </button>
      )}

      {issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          No responsive issues detected. Your page should look good on phones.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {issues.map((issue, idx) => (
            <IssueRow
              key={`${issue.rule}-${issue.nodeId}-${idx}`}
              issue={issue}
              onFix={() => applyOne(issue)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const IssueRow: React.FC<{ issue: ResponsiveIssue; onFix: () => void }> = ({ issue, onFix }) => {
  const { actions } = useEditor();

  const select = (): void => {
    try {
      actions.selectNode(issue.nodeId);
    } catch {
      /* node gone */
    }
  };

  const fix = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onFix();
  };

  const Icon = issue.severity === "error" ? AlertCircle : AlertTriangle;
  const tone = issue.severity === "error" ? "text-red-500" : "text-amber-500";

  return (
    <button
      type="button"
      onClick={select}
      className="flex w-full flex-col gap-1 rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-start gap-1.5">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
        <span className="leading-snug">
          <span className="font-medium">{issue.blockName || "Block"}:</span> {issue.message}
        </span>
      </div>
      {issue.fix && (
        <span
          role="button"
          tabIndex={0}
          onClick={fix}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fix(e as unknown as React.MouseEvent);
          }}
          className="ml-5 inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
        >
          <Wand2 className="h-3 w-3" />
          {issue.fix.label}
        </span>
      )}
    </button>
  );
};
