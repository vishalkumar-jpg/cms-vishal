import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExperimentMutations } from "../hooks/useExperiments";
import type { Experiment, GoalType, VariantInput } from "../api/experiments.api";

/**
 * Create/edit an experiment (Phase 4). Name + goal (type + optional path) + a
 * weighted variant list (at least 2, one control). Variants replace the full set
 * on save. Weights need not sum to 100 — the split is weight-proportional.
 */
export function ExperimentEditor({
  experiment,
  onClose,
}: {
  experiment: Experiment | null;
  onClose: () => void;
}) {
  const { create, update } = useExperimentMutations();

  const [name, setName] = useState(experiment?.name ?? "");
  const [description, setDescription] = useState(experiment?.description ?? "");
  const [goalType, setGoalType] = useState<GoalType>(experiment?.goalType ?? "pageview");
  const [goalPath, setGoalPath] = useState(experiment?.goalPath ?? "");
  const [variants, setVariants] = useState<VariantInput[]>(
    experiment?.variants.length
      ? experiment.variants.map((v) => ({
          key: v.key,
          name: v.name,
          weight: v.weight,
          isControl: v.isControl,
        }))
      : [
          { key: "A", name: "Control", weight: 1, isControl: true },
          { key: "B", name: "Variant B", weight: 1, isControl: false },
        ],
  );

  const setVariant = (i: number, patch: Partial<VariantInput>): void =>
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const addVariant = (): void => {
    const nextKey = String.fromCharCode(65 + variants.length);
    setVariants((prev) => [...prev, { key: nextKey, name: `Variant ${nextKey}`, weight: 1 }]);
  };

  const removeVariant = (i: number): void =>
    setVariants((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const setControl = (i: number): void =>
    setVariants((prev) => prev.map((v, idx) => ({ ...v, isControl: idx === i })));

  const valid =
    name.trim().length > 0 &&
    variants.length >= 2 &&
    new Set(variants.map((v) => v.key.trim())).size === variants.length &&
    variants.every((v) => v.key.trim() && v.name.trim());

  const save = (): void => {
    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      goalType,
      goalPath: goalType === "pageview" ? goalPath.trim() || undefined : undefined,
      variants,
    };
    if (experiment) update.mutate({ id: experiment.id, data }, { onSuccess: onClose });
    else create.mutate(data, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{experiment ? "Edit experiment" : "New experiment"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Homepage hero test" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Goal</Label>
              <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pageview">Pageview of path</SelectItem>
                  <SelectItem value="click">Click (data-ab-goal)</SelectItem>
                  <SelectItem value="form_submit">Form submit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {goalType === "pageview" && (
              <div className="flex flex-col gap-1.5">
                <Label>Goal path</Label>
                <Input value={goalPath} onChange={(e) => setGoalPath(e.target.value)} placeholder="/thank-you" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Variants</Label>
              <Button variant="outline" size="sm" onClick={addVariant}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add variant
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Input
                    className="w-14"
                    value={v.key}
                    onChange={(e) => setVariant(i, { key: e.target.value.toUpperCase().slice(0, 4) })}
                    placeholder="A"
                  />
                  <Input
                    className="flex-1"
                    value={v.name}
                    onChange={(e) => setVariant(i, { name: e.target.value })}
                    placeholder="Variant name"
                  />
                  <Input
                    className="w-20"
                    type="number"
                    min={1}
                    value={v.weight ?? 1}
                    onChange={(e) => setVariant(i, { weight: Math.max(1, Number(e.target.value) || 1) })}
                    title="Traffic weight"
                  />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input type="radio" checked={!!v.isControl} onChange={() => setControl(i)} />
                    control
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={variants.length <= 2}
                    onClick={() => removeVariant(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Traffic is split proportionally by weight. To A/B test a section, add an Experiment
              block in the builder and attach this experiment.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || create.isPending || update.isPending} onClick={save}>
            {experiment ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
