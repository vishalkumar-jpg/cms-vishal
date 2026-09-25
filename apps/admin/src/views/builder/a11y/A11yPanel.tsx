import * as React from "react";
import { useEditor } from "@craftjs/core";
import { AlertTriangle, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";
import { useUpdateProp } from "../property/useUpdateProp";
import { useA11yIssues } from "./useA11yIssues";
import type { A11yIssue, A11yScore } from "./checks";

/**
 * A11y panel — live list of accessibility issues for the current page, grouped
 * by severity, with a score badge. Clicking an issue selects the offending node
 * on the canvas. Issues that carry a `fix` offer a one-click action (apply a
 * prop fix, or select the node so the user can edit the field). Recomputes
 * (debounced) as the layout changes.
 */
export const A11yPanel: React.FC = () => {
  const { issues, score } = useA11yIssues();
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <ScoreBadge score={score} />
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          No accessibility issues detected on this page.
        </div>
      ) : (
        <>
          {errors.length > 0 && (
            <Section title={`Errors (${errors.length})`}>
              {errors.map((i, idx) => (
                <IssueRow key={`${i.rule}-${i.nodeId}-${idx}`} issue={i} />
              ))}
            </Section>
          )}
          {warnings.length > 0 && (
            <Section title={`Warnings (${warnings.length})`}>
              {warnings.map((i, idx) => (
                <IssueRow key={`${i.rule}-${i.nodeId}-${idx}`} issue={i} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
};

const ScoreBadge: React.FC<{ score: A11yScore }> = ({ score }) => {
  const tone =
    score.grade === "A"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      : score.grade === "B" || score.grade === "C"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 ${tone}`}>
      <div>
        <p className="text-[11px] uppercase tracking-wide opacity-70">A11y score</p>
        <p className="text-lg font-bold leading-none">
          {score.score}
          <span className="ml-1 text-xs font-semibold">{score.grade}</span>
        </p>
      </div>
      <div className="text-right text-[11px]">
        <p>{score.errors} errors</p>
        <p>{score.warnings} warnings</p>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </p>
    {children}
  </div>
);

const IssueRow: React.FC<{ issue: A11yIssue }> = ({ issue }) => {
  const { actions } = useEditor();
  const update = useUpdateProp(issue.nodeId);

  const select = (): void => {
    try {
      actions.selectNode(issue.nodeId);
    } catch {
      /* node may have been removed mid-edit */
    }
  };

  const applyFix = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const fix = issue.fix;
    if (!fix) return;
    if (fix.kind === "set-prop") {
      update(fix.path, fix.value);
    } else {
      // focus-field / ai-alt: select the node so the user can edit the control.
      select();
    }
  };

  const Icon = issue.severity === "error" ? AlertCircle : AlertTriangle;
  const iconTone = issue.severity === "error" ? "text-red-500" : "text-amber-500";

  return (
    <button
      type="button"
      onClick={select}
      className="flex w-full flex-col gap-1 rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-start gap-1.5">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconTone}`} />
        <span className="leading-snug">{issue.message}</span>
      </div>
      {issue.fix && (
        <span
          role="button"
          tabIndex={0}
          onClick={applyFix}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") applyFix(e as unknown as React.MouseEvent);
          }}
          className="ml-5 inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
        >
          <Wand2 className="h-3 w-3" />
          {issue.fix.kind === "set-prop" ? issue.fix.label : "Go to field"}
        </span>
      )}
    </button>
  );
};
