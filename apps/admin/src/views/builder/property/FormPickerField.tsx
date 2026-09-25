import * as React from "react";
import { Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForms } from "@/views/forms/hooks/useForms";

/**
 * Form picker for the Form block's `formId` prop. Lists the active site's forms
 * (via the existing `useForms` hook → `GET /api/forms`) and stores the chosen
 * form id on the block prop. Selecting a form drives the canvas preview (the
 * builder's preview FormRenderContext fetches that form's fields).
 */
export const FormPickerField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const { data: forms = [], isLoading } = useForms();

  const options = React.useMemo(
    () =>
      [...forms].sort((a, b) => a.name.localeCompare(b.name)),
    [forms],
  );

  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Loading forms…</p>
      ) : options.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No forms yet. Create one in the Forms manager.
        </p>
      ) : (
        <Select
          value={value || undefined}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select a form…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
                {f.status !== "published" ? (
                  <span className="text-muted-foreground"> ({f.status})</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
