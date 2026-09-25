import * as React from "react";
import { Search, Plus, Star, Clock } from "lucide-react";
import { Input } from "@/components/ui";
import { blockRegistry } from "@ob-cms/blocks";
import { labelFor, metaFor } from "../blocks/blockMeta";
import { iconFor } from "../blocks/blockIcons";
import { useBlockInsert } from "../hooks/useBlockInsert";
import { useEditorUiStore } from "../store/editorUiStore";
import { fuzzyScore } from "../utils/fuzzyMatch";
import { ReusableBlocksQuickList } from "./ReusableBlocksQuickList";

interface QuickBlockPickerProps {
  insertIndex?: number;
  onInserted?: () => void;
  compact?: boolean;
}

/**
 * Shared block picker: search + favorites + recent.
 * Used by section quick-insert and command palette insert flows.
 */
export const QuickBlockPicker: React.FC<QuickBlockPickerProps> = ({
  insertIndex,
  onInserted,
  compact,
}) => {
  const [term, setTerm] = React.useState("");
  const { insert, insertAt } = useBlockInsert();
  const favoriteBlocks = useEditorUiStore((s) => s.favoriteBlocks);
  const recentBlocks = useEditorUiStore((s) => s.recentBlocks);

  const doInsert = (name: string): void => {
    if (insertIndex != null) insertAt(name, insertIndex);
    else insert(name);
    onInserted?.();
  };

  const matches = React.useMemo(() => {
    const q = term.trim();
    return Object.keys(blockRegistry)
      .filter((n) => n !== "Reusable Block")
      .map((name) => ({
        name,
        score: q
          ? Math.max(
              fuzzyScore(labelFor(name), q),
              fuzzyScore(name, q),
              fuzzyScore(metaFor(name).summary, q),
            )
          : 1,
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, compact ? 12 : 24);
  }, [term, compact]);

  const favorites = favoriteBlocks.filter((n) => blockRegistry[n]);
  const recent = recentBlocks.filter((n) => blockRegistry[n] && !favorites.includes(n));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search blocks…"
          className="h-8 pl-8 text-xs"
          autoFocus
        />
      </div>

      {!term && favorites.length > 0 && (
        <Section title="Favorites" icon={<Star className="h-3 w-3" />}>
          {favorites.map((name) => (
            <Row key={name} name={name} onPick={() => doInsert(name)} />
          ))}
        </Section>
      )}

      {!term && recent.length > 0 && (
        <Section title="Recent" icon={<Clock className="h-3 w-3" />}>
          {recent.slice(0, 6).map((name) => (
            <Row key={name} name={name} onPick={() => doInsert(name)} />
          ))}
        </Section>
      )}

      <Section title={term ? "Results" : "All blocks"} icon={<Plus className="h-3 w-3" />}>
        {matches.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No blocks match.</p>
        ) : (
          matches.map(({ name }) => (
            <Row key={name} name={name} onPick={() => doInsert(name)} />
          ))
        )}
      </Section>

      {!term ? <ReusableBlocksQuickList insertIndex={insertIndex} onInserted={onInserted} /> : null}
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div>
    <p className="mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {title}
    </p>
    <div className="flex flex-col gap-0.5">{children}</div>
  </div>
);

const Row: React.FC<{ name: string; onPick: () => void }> = ({ name, onPick }) => {
  const Icon = iconFor(name);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="truncate font-medium">{labelFor(name)}</span>
    </button>
  );
};
