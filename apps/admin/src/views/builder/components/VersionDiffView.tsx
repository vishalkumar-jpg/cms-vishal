import * as React from "react";
import { ArrowRight, Plus, Minus, Move, Pencil } from "lucide-react";
import { RenderLayout, blockRegistry, OBSiteRoot } from "@ob-cms/blocks";
import { migrate, type SerializedLayout } from "@ob-cms/block-schema";
import { diffLayouts, summaryText, type BlockDiff } from "./layoutDiff";

/** Compact scalar → display string for before→after text. */
const fmt = (v: unknown): string => {
  if (v === undefined) return "∅";
  if (v === null) return "null";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 57)}…` : `"${v}"`;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return "{…}";
};

const KIND_STYLES: Record<
  BlockDiff["kind"],
  { badge: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  added: { badge: "bg-emerald-100 text-emerald-700", icon: Plus, label: "Added" },
  removed: { badge: "bg-red-100 text-red-700", icon: Minus, label: "Removed" },
  moved: { badge: "bg-sky-100 text-sky-700", icon: Move, label: "Moved" },
  changed: { badge: "bg-amber-100 text-amber-700", icon: Pencil, label: "Changed" },
  unchanged: { badge: "bg-muted text-muted-foreground", icon: Pencil, label: "Unchanged" },
};

const DiffRow: React.FC<{ block: BlockDiff }> = ({ block }) => {
  const s = KIND_STYLES[block.kind];
  const Icon = s.icon;
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${s.badge}`}
        >
          <Icon className="h-3 w-3" /> {s.label}
        </span>
        <span className="truncate text-sm font-medium">{block.label}</span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
          {block.id.slice(0, 8)}
        </span>
      </div>
      {block.changedProps.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          props: {block.changedProps.join(", ")}
        </p>
      )}
      {block.textChanges
        .filter((c) => c.scalar)
        .slice(0, 6)
        .map((c) => (
          <div key={c.prop} className="mt-1 flex items-center gap-1 text-[11px]">
            <span className="font-medium">{c.prop}:</span>
            <span className="text-red-600 line-through">{fmt(c.before)}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-emerald-600">{fmt(c.after)}</span>
          </div>
        ))}
    </div>
  );
};

const MiniPreview: React.FC<{ layout: SerializedLayout | null; title: string }> = ({
  layout,
  title,
}) => (
  <div className="flex min-w-0 flex-1 flex-col">
    <div className="mb-1 truncate text-[11px] font-medium text-muted-foreground">{title}</div>
    <div className="h-64 overflow-hidden rounded-md border border-border bg-white">
      {layout ? (
        <div
          className="origin-top-left"
          style={{ width: 1280, transform: "scale(0.28)", transformOrigin: "top left" }}
        >
          <OBSiteRoot>
            <RenderLayout data={layout} blocks={blockRegistry} wrap={false} repairLegacyLayout />
          </OBSiteRoot>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
          No layout
        </div>
      )}
    </div>
  </div>
);

/**
 * Read-only version compare. Given two layout snapshots (older `prev` / newer
 * `next`) it renders a structural diff summary + per-block added/removed/moved/
 * changed list, and an optional side-by-side scaled render of both versions.
 */
export const VersionDiffView: React.FC<{
  prevLayout: SerializedLayout | null;
  nextLayout: SerializedLayout | null;
  prevLabel: string;
  nextLabel: string;
}> = ({ prevLayout, nextLayout, prevLabel, nextLabel }) => {
  const [showPreview, setShowPreview] = React.useState(false);

  const prev = React.useMemo(() => (prevLayout ? migrate(prevLayout) : null), [prevLayout]);
  const next = React.useMemo(() => (nextLayout ? migrate(nextLayout) : null), [nextLayout]);

  const diff = React.useMemo(() => {
    if (!prev || !next) return null;
    return diffLayouts(prev, next);
  }, [prev, next]);

  const visible = React.useMemo(
    () => diff?.blocks.filter((b) => b.kind !== "unchanged") ?? [],
    [diff],
  );

  if (!prev || !next) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Both selected versions need a layout snapshot to compare.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{prevLabel}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{nextLabel}</span>
      </div>

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
        {diff ? summaryText(diff.summary) : "—"}
      </div>

      <button
        type="button"
        className="text-xs text-primary underline-offset-2 hover:underline"
        onClick={() => setShowPreview((v) => !v)}
      >
        {showPreview ? "Hide" : "Show"} side-by-side preview
      </button>

      {showPreview && (
        <div className="flex gap-3">
          <MiniPreview layout={prev} title={prevLabel} />
          <MiniPreview layout={next} title={nextLabel} />
        </div>
      )}

      <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No structural changes between these versions.
          </p>
        ) : (
          visible.map((b) => <DiffRow key={`${b.kind}-${b.id}`} block={b} />)
        )}
      </div>
    </div>
  );
};
