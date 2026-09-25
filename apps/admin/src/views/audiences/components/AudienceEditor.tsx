import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui";
import { RuleBuilder, newGroup, type RuleField, type RuleGroup } from "@/components/rule-builder";
import { useRuleFields } from "@/views/identity/hooks/useIdentity";
import { useAudienceMutations } from "../hooks/useAudiences";
import { apiToBuilder, builderToApi } from "../rule-adapter";
import { previewAudienceRequest, type Audience } from "../api/audiences.api";

/**
 * Create/edit an audience. Reuses the shared RuleBuilder (AND/OR tree), converts
 * to/from the API rule shape via the rule-adapter, and shows a live preview
 * count (debounced) as the rules change.
 */
export function AudienceEditor({
  audience,
  onClose,
}: {
  audience: Audience | null;
  onClose: () => void;
}) {
  const { data: meta } = useRuleFields();
  const { create, update } = useAudienceMutations();

  const [name, setName] = useState(audience?.name ?? "");
  const [description, setDescription] = useState(audience?.description ?? "");
  const [group, setGroup] = useState<RuleGroup>(
    audience ? apiToBuilder(audience.rules) : newGroup("and"),
  );

  const fields: RuleField[] = useMemo(
    () => (meta?.fields ?? []).map((f) => ({ name: f.name, label: f.label, type: f.type })),
    [meta],
  );

  // Live preview count (debounced) for the current rule tree.
  const apiRules = useMemo(() => builderToApi(group), [group]);
  const [debounced, setDebounced] = useState(apiRules);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(apiRules), 400);
    return () => clearTimeout(t);
  }, [apiRules]);
  const preview = useQuery({
    queryKey: ["audience-preview", JSON.stringify(debounced)],
    queryFn: () => previewAudienceRequest(debounced),
  });

  const save = () => {
    if (!name.trim()) return;
    const data = { name, description: description || undefined, rules: builderToApi(group) };
    if (audience) update.mutate({ id: audience.id, data }, { onSuccess: onClose });
    else create.mutate(data, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{audience ? "Edit audience" : "New audience"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="aud-name">Name</Label>
            <Input
              id="aud-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High-intent accounts"
            />
          </div>
          <div>
            <Label htmlFor="aud-desc">Description</Label>
            <Input
              id="aud-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Rules</Label>
              <Badge variant={preview.data ? "success" : "muted"}>
                {preview.isFetching
                  ? "counting…"
                  : preview.data
                    ? `${preview.data.count} of ${preview.data.total} match`
                    : "—"}
              </Badge>
            </div>
            <RuleBuilder fields={fields} value={group} onChange={setGroup} maxDepth={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={create.isPending || update.isPending}>
            {audience ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
