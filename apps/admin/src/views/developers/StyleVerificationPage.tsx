"use client";

import * as React from "react";
import {
  blockRegistry,
  OBSiteRoot,
  buildBlockAuditEntries,
  STYLE_AUDIT_FIXTURE,
  STYLE_AUDIT_SKIP_TYPES,
  STYLE_AUDIT_SPLIT_SURFACE_TYPES,
  verifyStylePipeline,
  verifyElementStyles,
  verifySplitSurfaceBlock,
  type PipelineCheckResult,
  type DomStyleCheck,
  type SplitSurfaceCheck,
} from "@ob-cms/blocks";
import "@ob-cms/blocks/blocks.css";

/**
 * Developer regression page — renders one instance of every registered block
 * with the canonical STYLE_AUDIT_FIXTURE and compares pipeline + computed styles.
 * Route: /developers/style-verification
 */
export const StyleVerificationPage: React.FC = () => {
  const [pipelineResults, setPipelineResults] = React.useState<PipelineCheckResult[]>([]);
  const [domResults, setDomResults] = React.useState<
    Array<{ type: string; checks: DomStyleCheck[]; pass: boolean }>
  >([]);
  const [splitResults, setSplitResults] = React.useState<SplitSurfaceCheck[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const entries = React.useMemo(
    () =>
      buildBlockAuditEntries((type) => blockRegistry[type]?.defaultProps ?? {}),
    [],
  );

  React.useEffect(() => {
    setPipelineResults(verifyStylePipeline());
  }, []);

  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-ob-audit-wrap]");
    const results: Array<{ type: string; checks: DomStyleCheck[]; pass: boolean }> = [];
    nodes.forEach((wrap) => {
      const type = wrap.dataset.obAuditType ?? "unknown";
      const el = wrap.firstElementChild as HTMLElement | null;
      if (!el) return;
      const checks = verifyElementStyles(el);
      results.push({ type, checks, pass: checks.every((c) => c.pass) });
    });
    setDomResults(results);
    const splits: SplitSurfaceCheck[] = [];
    nodes.forEach((wrap) => {
      const type = wrap.dataset.obAuditType ?? "unknown";
      if (STYLE_AUDIT_SPLIT_SURFACE_TYPES.has(type)) {
        splits.push(verifySplitSurfaceBlock(wrap, type));
      }
    });
    setSplitResults(splits);
  }, [entries.length]);

  const pipelinePass = pipelineResults.filter((r) => r.pass).length;
  const pipelineFail = pipelineResults.filter((r) => !r.pass);
  const domPass = domResults.filter((r) => r.pass).length;
  const domFail = domResults.filter((r) => !r.pass);
  const splitPass = splitResults.filter((r) => r.pass).length;
  const splitFail = splitResults.filter((r) => !r.pass);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Style System Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regression suite for the Property Panel → StyleModel → block renderer pipeline.
          Each block renders with <code className="text-xs">STYLE_AUDIT_FIXTURE</code>.
        </p>
      </div>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="text-lg font-medium">Pipeline checks</h2>
        <p className="text-sm text-muted-foreground">
          {pipelinePass}/{pipelineResults.length} passed
        </p>
        {pipelineFail.length > 0 ? (
          <ul className="mt-3 max-h-48 overflow-auto text-sm text-destructive">
            {pipelineFail.map((r) => (
              <li key={r.name}>
                {r.name}: expected {JSON.stringify(r.expected)}, got {JSON.stringify(r.actual)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-green-700">All pipeline checks passed.</p>
        )}
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="text-lg font-medium">DOM computed-style checks</h2>
        <p className="text-sm text-muted-foreground">
          {domPass}/{domResults.length} blocks passed (skipped:{" "}
          {STYLE_AUDIT_SKIP_TYPES.size} context-dependent types)
        </p>
        {domFail.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-destructive">
              {domFail.length} block(s) with mismatches
            </summary>
            <ul className="mt-2 max-h-64 overflow-auto text-xs">
              {domFail.map(({ type, checks }) => (
                <li key={type} className="mb-2">
                  <strong>{type}</strong>
                  <ul>
                    {checks.filter((c) => !c.pass).map((c) => (
                      <li key={c.property}>
                        {c.property}: expected {c.expected}, got {c.actual}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        ) : domResults.length > 0 ? (
          <p className="mt-2 text-sm text-green-700">All sampled DOM checks passed.</p>
        ) : null}
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="text-lg font-medium">Split-surface checks</h2>
        <p className="text-sm text-muted-foreground">
          {splitPass}/{splitResults.length} split-surface blocks passed
        </p>
        {splitFail.length > 0 ? (
          <ul className="mt-3 max-h-48 overflow-auto text-sm text-destructive">
            {splitFail.map((r) => (
              <li key={r.type}>
                {r.type}: surface={String(r.hasSurface)}, ob-btn={String(r.hasObBtn)}, vars=
                {String(r.hasResponsiveVars)}
              </li>
            ))}
          </ul>
        ) : splitResults.length > 0 ? (
          <p className="mt-2 text-sm text-green-700">All split-surface checks passed.</p>
        ) : null}
      </section>

      <OBSiteRoot className="ob-site rounded-lg border bg-white p-4">
        <div ref={containerRef} className="space-y-6">
          {entries.map(({ type, props }) => {
            const entry = blockRegistry[type];
            if (!entry) return null;
            const Component = entry.component;
            return (
              <div key={type} data-ob-audit-wrap data-ob-audit-type={type} className="rounded border border-dashed p-2">
                <div className="mb-1 text-xs font-medium text-muted-foreground">{type}</div>
                <Component {...props} />
              </div>
            );
          })}
        </div>
      </OBSiteRoot>

      <section className="mt-8 rounded-lg border p-4 text-xs text-muted-foreground">
        <p>
          Fixture keys: padding 16/20px, margin 8/4px, width 320px, bg #e2e8f0, text #1e293b,
          border-radius 8px, opacity 0.95.
        </p>
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2">
          {JSON.stringify(STYLE_AUDIT_FIXTURE, null, 2)}
        </pre>
      </section>
    </div>
  );
};
