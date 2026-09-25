import * as React from "react";
import { Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollections } from "@/views/collections/hooks/useCollections";

/**
 * Collection picker for the Collection List block's `collectionSlug` prop. Lists
 * the active site's collections (via `useCollections` → `GET /api/collections`)
 * and stores the chosen collection SLUG on the block prop. Selecting a
 * collection drives the canvas preview (the preview CollectionRenderContext
 * fetches that collection's items by slug).
 */
export const CollectionPickerField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const { data: collections = [], isLoading } = useCollections();

  const options = React.useMemo(
    () => [...collections].sort((a, b) => a.name.localeCompare(b.name)),
    [collections],
  );

  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Loading collections…</p>
      ) : options.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No collections yet. Create one in the Collections manager.
        </p>
      ) : (
        <Select value={value || undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select a collection…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.name}
                <span className="text-muted-foreground"> ({c.fields.length} fields)</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
