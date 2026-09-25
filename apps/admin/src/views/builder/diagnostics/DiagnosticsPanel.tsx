import * as React from "react";
import { useEditor } from "@craftjs/core";
import { hasInteractions } from "@ob-cms/block-schema";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Image,
  Layers,
  Sparkles,
  Palette,
  Copy,
  GitBranch,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useResponsiveAudit } from "../responsive/useResponsiveAudit";

interface DiagnosticsPanelProps {
  onClose?: () => void;
}

const MAX_DEPTH_WARN = 12;
const LARGE_SUBTREE = 40;

/**
 * Builder diagnostics — page health at a glance with actionable suggestions.
 */
export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ onClose }) => {
  const { query } = useEditor();
  const audit = useResponsiveAudit();

  const stats = React.useMemo(() => {
    const nodes = query.getNodes();
    const ids = Object.keys(nodes).filter((id) => id !== "ROOT");
    let animCount = 0;
    let heavyAnim = 0;
    let missingImages = 0;
    let largeImages = 0;
    let largeShadows = 0;
    let largeGradients = 0;
    let unusedStyleKeys = 0;
    let detachedNodes = 0;
    let maxDepth = 0;
    let deepestId = "";
    const styleHashes = new Map<string, string[]>();
    const duplicateStyles: string[] = [];
    const subtreeSizes = new Map<string, number>();

    const countSubtree = (id: string): number => {
      const childIds = nodes[id]?.data?.nodes ?? [];
      let n = 1;
      for (const cid of childIds) n += countSubtree(cid);
      return n;
    };

    const depthOf = (id: string, d = 0): number => {
      const parent = nodes[id]?.data?.parent;
      if (!parent || parent === "ROOT") return d;
      return depthOf(parent, d + 1);
    };

    for (const id of ids) {
      try {
        const node = nodes[id];
        if (!node?.data?.parent && id !== "ROOT") detachedNodes++;
        const depth = depthOf(id);
        if (depth > maxDepth) {
          maxDepth = depth;
          deepestId = id;
        }
        subtreeSizes.set(id, countSubtree(id));

        const props = (node?.data?.props ?? {}) as Record<string, unknown>;
        const styles = (props.styles ?? {}) as Record<string, unknown>;
        if (hasInteractions(styles)) {
          animCount++;
          const anim = (styles.interactions as Record<string, unknown>)?.animation as
            | Record<string, unknown>
            | undefined;
          if (Number(anim?.duration) > 2 || Number(anim?.stagger) > 0.5) heavyAnim++;
        }
        const shadows = (styles.shadows ?? {}) as Record<string, unknown>;
        const box = String(shadows.boxShadow ?? "");
        if (box.length > 80) largeShadows++;

        const bg = String((styles.background as Record<string, unknown> | undefined)?.value ?? "");
        if (bg.includes("gradient") && bg.length > 120) largeGradients++;

        const name = node?.data?.name ?? "";
        const src = String(props.src ?? props.url ?? "");
        if (name === "Image") {
          if (!src) missingImages++;
          else if (src.length > 200 || (src.includes("unsplash") && src.includes("w=4000")))
            largeImages++;
        }

        const hash = JSON.stringify(styles);
        if (hash !== "{}") {
          const peers = styleHashes.get(hash) ?? [];
          peers.push(id);
          styleHashes.set(hash, peers);
        } else if (Object.keys(styles).length > 0) {
          unusedStyleKeys++;
        }
      } catch {
        /* skip broken node */
      }
    }

    for (const [, peers] of styleHashes) {
      if (peers.length > 2)
        duplicateStyles.push(`${peers.length} blocks share identical styles`);
    }

    let largestSubtreeId = "";
    let largestSubtree = 0;
    for (const [id, size] of subtreeSizes) {
      if (size > largestSubtree) {
        largestSubtree = size;
        largestSubtreeId = id;
      }
    }

    let jsonSize = 0;
    try {
      jsonSize = new Blob([query.serialize()]).size;
    } catch {
      jsonSize = 0;
    }
    const domEstimate = ids.length * 12;
    const bundleKb = Math.round(jsonSize / 1024 + ids.length * 0.4);
    const a11yScore = Math.max(0, 100 - audit.issues.length * 8 - missingImages * 4);
    const perfScore = Math.max(
      0,
      100 -
        Math.floor(jsonSize / 8000) -
        missingImages * 5 -
        largeShadows * 3 -
        heavyAnim * 4 -
        (maxDepth > MAX_DEPTH_WARN ? 10 : 0) -
        (largestSubtree > LARGE_SUBTREE ? 8 : 0),
    );
    const responsiveScore = Math.max(0, 100 - audit.issues.length * 10);
    const consistencyScore = Math.max(0, 100 - duplicateStyles.length * 15);
    const maintainabilityScore = Math.max(
      0,
      100 -
        Math.floor(maxDepth / 2) * 3 -
        (largestSubtree > LARGE_SUBTREE ? 15 : 0) -
        duplicateStyles.length * 10 -
        detachedNodes * 20,
    );
    const overallHealth = Math.round(
      (perfScore + responsiveScore + a11yScore + consistencyScore + maintainabilityScore) / 5,
    );

    return {
      nodeCount: ids.length,
      jsonSize,
      domEstimate,
      animCount,
      heavyAnim,
      missingImages,
      largeImages,
      largeShadows,
      largeGradients,
      duplicateStyles: duplicateStyles.length,
      a11yScore,
      perfScore,
      responsiveScore,
      consistencyScore,
      maintainabilityScore,
      overallHealth,
      domWarn: domEstimate > 800,
      maxDepth,
      deepestId,
      largestSubtree,
      largestSubtreeId,
      detachedNodes,
      unusedStyleKeys,
      bundleKb,
    };
  }, [query, audit.issues.length]);

  const fmt = (n: number): string =>
    n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;

  const Score: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="rounded-md border border-border p-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${value >= 80 ? "text-green-600" : value >= 50 ? "text-amber-600" : "text-red-600"}`}
      >
        {value}
      </p>
    </div>
  );

  const suggestions: string[] = [];
  if (stats.domWarn)
    suggestions.push(
      "Large page — consider splitting into reusable sections or lazy-loading below-the-fold content.",
    );
  if (stats.heavyAnim > 0)
    suggestions.push(
      `${stats.heavyAnim} block(s) use long or heavy animations — shorten duration for smoother scrolling.`,
    );
  if (stats.largeImages > 0)
    suggestions.push("Some images may be oversized — use compressed assets from the media library.");
  if (stats.missingImages > 0)
    suggestions.push(`${stats.missingImages} image block(s) are missing a source URL.`);
  if (stats.duplicateStyles > 0)
    suggestions.push("Several blocks share identical styles — consider a reusable block or global style.");
  if (stats.maxDepth > MAX_DEPTH_WARN)
    suggestions.push(
      `Deep nesting (${stats.maxDepth} levels) — flatten layout or use section components for maintainability.`,
    );
  if (stats.largestSubtree > LARGE_SUBTREE)
    suggestions.push(
      `Largest subtree has ${stats.largestSubtree} blocks — break into reusable sections.`,
    );
  if (stats.detachedNodes > 0)
    suggestions.push(`${stats.detachedNodes} node(s) appear detached from the tree — re-save or restore from history.`);
  if (stats.largeGradients > 0)
    suggestions.push("Complex gradients detected — simplify for better paint performance.");
  if (audit.issues.length > 0)
    suggestions.push(...audit.issues.slice(0, 4).map((i) => i.message));

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 text-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Gauge className="h-4 w-4" />
          Diagnostics
        </h3>
        {onClose ? (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-center">
        <p className="text-[10px] uppercase text-muted-foreground">Overall builder health</p>
        <p
          className={`text-3xl font-bold ${stats.overallHealth >= 80 ? "text-green-600" : stats.overallHealth >= 50 ? "text-amber-600" : "text-red-600"}`}
        >
          {stats.overallHealth}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Score label="Performance" value={stats.perfScore} />
        <Score label="Responsive" value={stats.responsiveScore} />
        <Score label="Accessibility" value={stats.a11yScore} />
        <Score label="Consistency" value={stats.consistencyScore} />
        <Score label="Maintainability" value={stats.maintainabilityScore} />
        <Score label="Est. bundle" value={Math.min(100, Math.max(0, 100 - stats.bundleKb / 5))} />
      </div>

      <ul className="space-y-2 text-xs">
        <Metric icon={Layers} label="Blocks on page" value={String(stats.nodeCount)} warn={stats.nodeCount > 120} />
        <Metric icon={Gauge} label="Layout JSON size" value={fmt(stats.jsonSize)} warn={stats.jsonSize > 500_000} />
        <Metric icon={Layers} label="Est. DOM nodes" value={`~${stats.domEstimate}`} warn={stats.domWarn} />
        <Metric icon={Box} label="Est. bundle impact" value={`~${stats.bundleKb} KB`} warn={stats.bundleKb > 400} />
        <Metric
          icon={GitBranch}
          label="Max nesting depth"
          value={String(stats.maxDepth)}
          warn={stats.maxDepth > MAX_DEPTH_WARN}
        />
        <Metric
          icon={Layers}
          label="Largest subtree"
          value={`${stats.largestSubtree} blocks`}
          warn={stats.largestSubtree > LARGE_SUBTREE}
        />
        <Metric icon={Sparkles} label="Animated blocks" value={String(stats.animCount)} />
        <Metric icon={Sparkles} label="Heavy animations" value={String(stats.heavyAnim)} warn={stats.heavyAnim > 0} />
        <Metric icon={Image} label="Images missing src" value={String(stats.missingImages)} warn={stats.missingImages > 0} />
        <Metric icon={Image} label="Possibly large images" value={String(stats.largeImages)} warn={stats.largeImages > 0} />
        <Metric icon={AlertTriangle} label="Heavy shadows" value={String(stats.largeShadows)} warn={stats.largeShadows > 0} />
        <Metric icon={Palette} label="Complex gradients" value={String(stats.largeGradients)} warn={stats.largeGradients > 0} />
        <Metric icon={Copy} label="Duplicate style groups" value={String(stats.duplicateStyles)} warn={stats.duplicateStyles > 0} />
        <Metric icon={AlertTriangle} label="Detached nodes" value={String(stats.detachedNodes)} warn={stats.detachedNodes > 0} />
        <Metric icon={CheckCircle2} label="Responsive issues" value={String(audit.issues.length)} warn={audit.issues.length > 0} />
        <Metric icon={Palette} label="Style consistency" value={`${stats.consistencyScore}%`} warn={stats.consistencyScore < 70} />
      </ul>

      {suggestions.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Actionable fixes</p>
          {suggestions.map((msg, i) => (
            <p key={i} className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-snug">
              {msg}
            </p>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Open the Responsive tab in the property panel for one-click fixes where available.
          </p>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warn?: boolean;
}> = ({ icon: Icon, label, value, warn }) => (
  <li className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
    <span className="flex items-center gap-2 text-muted-foreground">
      <Icon className={`h-3.5 w-3.5 ${warn ? "text-amber-600" : ""}`} />
      {label}
    </span>
    <span className={`font-medium ${warn ? "text-amber-600" : ""}`}>{value}</span>
  </li>
);
