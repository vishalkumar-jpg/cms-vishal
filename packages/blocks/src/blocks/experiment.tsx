"use client";

import * as React from "react";
import type { SerializedLayout, NodeExperiment } from "@ob-cms/block-schema";
import { applyRootBlockStyles, useMounted } from "../lib";
import { renderSubtree } from "../render-layout";
import { blockRegistry } from "../registry";
import type { RenderEnv } from "../render-context";
import { assignVariant, type AssignVariant } from "../experiment-assign";

/**
 * Experiment — a Phase 4 A/B-testing CANVAS block. Each direct child subtree is
 * one authored variant (mapped to a key "A"/"B"/… via the node's `experiment`
 * field). Same component, editor↔renderer parity:
 *
 *  - RENDERER: `renderNode` injects the serializable node map + variant child ids
 *    + the experiment mapping + env. The block resolves the visitor's variant
 *    (deterministic sticky split by `hash(visitorId + experimentId)` weighted by
 *    the experiment's variant weights), renders ONLY that variant's subtree via
 *    the shared walker, and fires an `exposure` beacon once. Assignment happens
 *    after mount (visitorId lives in `localStorage["ob_vid"]`), exactly like the
 *    Repeater resolves items after mount — SSR-safe, no hydration mismatch.
 *  - EDITOR: no injected node map → the block renders its Craft `children` with a
 *    variant switcher so the author can edit each variant's subtree in place.
 *
 * Weights + running status come from a public, host-resolved endpoint
 * (`/api/experiments/public/:id` via the same-origin proxy). If the experiment
 * is not running (draft/paused/done) the block renders the CONTROL variant and
 * fires NO exposure.
 */

const VISITOR_KEY = "ob_vid";

interface PublicVariant {
  key: string;
  weight: number;
  isControl: boolean;
}
interface PublicExperiment {
  id: string;
  status: "draft" | "running" | "paused" | "done";
  goalType: "pageview" | "click" | "form_submit";
  goalPath: string | null;
  variants: PublicVariant[];
}

/** localStorage key holding the visitor's active experiment assignments (for
 *  cross-page goal/conversion tracking). Shape: `{ [experimentId]: {...} }`. */
const ASSIGN_KEY = "ob_ab";

interface StoredAssignment {
  variant: string;
  goalType: "pageview" | "click" | "form_submit";
  goalPath: string | null;
}

function persistAssignment(experimentId: string, a: StoredAssignment): void {
  try {
    const raw = localStorage.getItem(ASSIGN_KEY);
    const map: Record<string, StoredAssignment> = raw ? JSON.parse(raw) : {};
    map[experimentId] = a;
    localStorage.setItem(ASSIGN_KEY, JSON.stringify(map));
  } catch {
    /* best-effort */
  }
}

interface ExperimentProps {
  styles?: unknown;
  /** Injected by the renderer's `renderNode` (all serializable plain JSON). */
  __data?: SerializedLayout;
  __variantIds?: string[];
  __experiment?: NodeExperiment;
  __env?: RenderEnv;
  /** Craft passes the authored variant children here (editor only). */
  children?: React.ReactNode;
}

function readVisitorId(): string | null {
  try {
    return localStorage.getItem(VISITOR_KEY);
  } catch {
    return null;
  }
}

/** Fire a single `exposure` custom-event beacon to the same-origin proxy. */
function sendExposure(experimentId: string, variant: string, visitorId: string, path: string): void {
  const body = JSON.stringify({
    events: [{ type: "event", name: "exposure", path, visitorId, sessionId: visitorId, experimentId, variant }],
  });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/collect", blob)) return;
    }
  } catch {
    /* fall through */
  }
  try {
    void fetch("/collect", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      cache: "no-store",
    });
  } catch {
    /* best-effort */
  }
}

const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      border: "1px dashed #cbd5e1",
      borderRadius: "0.5rem",
      padding: "1.5rem",
      textAlign: "center",
      color: "#64748b",
    }}
  >
    {label}
  </div>
);

export const Experiment = React.forwardRef<HTMLDivElement, ExperimentProps>(
  ({ styles, __data, __variantIds, __experiment, __env, children }, ref) => {
    const mounted = useMounted();
    const isRenderer = !!__data;
    const experimentId = __experiment?.experimentId;
    const variantKeys = React.useMemo(() => __experiment?.variantKeys ?? [], [__experiment]);
    const variantIds = React.useMemo(() => __variantIds ?? [], [__variantIds]);

    // Editor: which authored variant is being previewed.
    const [editorVariant, setEditorVariant] = React.useState(0);
    const [def, setDef] = React.useState<PublicExperiment | null>(null);
    const [assigned, setAssigned] = React.useState<string | null>(null);
    const firedRef = React.useRef(false);

    const rootStyle: React.CSSProperties = applyRootBlockStyles(styles, {
      structural: { display: "block", boxSizing: "border-box" },
    });

    // ── RENDERER MODE: resolve the experiment def after mount, then assign. ────
    React.useEffect(() => {
      if (!isRenderer || !mounted || !experimentId) return;
      let cancelled = false;
      fetch(`/api/experiments/public/${encodeURIComponent(experimentId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { data?: PublicExperiment } | PublicExperiment | null) => {
          if (cancelled || !body) return;
          const exp = (body as { data?: PublicExperiment }).data ?? (body as PublicExperiment);
          setDef(exp && exp.id ? exp : null);
        })
        .catch(() => {
          if (!cancelled) setDef(null);
        });
      return () => {
        cancelled = true;
      };
    }, [isRenderer, mounted, experimentId]);

    React.useEffect(() => {
      if (!isRenderer || !mounted || !experimentId || !def) return;
      const control = def.variants.find((v) => v.isControl)?.key ?? variantKeys[0] ?? def.variants[0]?.key;
      // Only running experiments split traffic + fire exposures. Otherwise show
      // the control (or first) variant with no exposure.
      if (def.status !== "running") {
        setAssigned(control ?? null);
        return;
      }
      const visitorId = readVisitorId() ?? __env?.visitorId ?? null;
      if (!visitorId) {
        setAssigned(control ?? null);
        return;
      }
      const weights: AssignVariant[] = def.variants.map((v) => ({ key: v.key, weight: v.weight }));
      const chosen = __env?.variants?.[experimentId] ?? assignVariant(visitorId, experimentId, weights) ?? control;
      setAssigned(chosen ?? null);
      if (chosen && !firedRef.current) {
        firedRef.current = true;
        const path = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
        // Persist the assignment (+ goal) so a page-level goal tracker can fire
        // the conversion — even on a different page than the Experiment block.
        persistAssignment(experimentId, {
          variant: chosen,
          goalType: def.goalType,
          goalPath: def.goalPath,
        });
        sendExposure(experimentId, chosen, visitorId, path);
      }
    }, [isRenderer, mounted, experimentId, def, variantKeys, __env]);

    // ── EDITOR MODE ──────────────────────────────────────────────────────────
    if (!isRenderer) {
      const childArray = React.Children.toArray(children);
      const activeKey = variantKeys[editorVariant] ?? String.fromCharCode(65 + editorVariant);
      return (
        <div ref={ref} style={rootStyle}>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: experimentId ? "#ecfeff" : "#fef2f2",
                color: experimentId ? "#0e7490" : "#b91c1c",
              }}
            >
              {experimentId ? "🧪 A/B Experiment" : "🧪 Attach an experiment in the panel"}
            </span>
            {childArray.map((_, i) => {
              const key = variantKeys[i] ?? String.fromCharCode(65 + i);
              const active = i === editorVariant;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditorVariant(i)}
                  style={{
                    padding: "2px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid #cbd5e1",
                    background: active ? "#0e7490" : "#fff",
                    color: active ? "#fff" : "#334155",
                  }}
                >
                  {`Variant ${key}`}
                </button>
              );
            })}
          </div>
          {/* Show the selected variant subtree; author edits it directly. Others
              are kept mounted (hidden) so Craft still tracks them for editing. */}
          {childArray.map((child, i) => (
            <div key={i} style={{ display: i === editorVariant ? "block" : "none" }} data-variant={variantKeys[i] ?? i}>
              {child}
            </div>
          ))}
          {childArray.length === 0 && <Placeholder label={`Variant ${activeKey} — drop blocks here`} />}
        </div>
      );
    }

    // ── RENDERER MODE ────────────────────────────────────────────────────────
    if (!experimentId) {
      return (
        <div ref={ref} style={rootStyle}>
          <Placeholder label="Experiment — attach an experiment" />
        </div>
      );
    }
    // Before assignment resolves, render nothing visible (avoids a flash of the
    // wrong variant). SSR emits this stable placeholder.
    if (!mounted || assigned === null) {
      return <div ref={ref} style={rootStyle} />;
    }
    // Map the assigned variant key → its child subtree id.
    const idx = variantKeys.indexOf(assigned);
    const chosenId = idx >= 0 ? variantIds[idx] : variantIds[0];
    const env = __env ?? {};
    return (
      <div ref={ref} style={rootStyle} data-experiment={experimentId} data-variant={assigned}>
        {chosenId
          ? renderSubtree([chosenId], __data as SerializedLayout, blockRegistry, { env, item: null })
          : null}
      </div>
    );
  },
);
Experiment.displayName = "Experiment";
