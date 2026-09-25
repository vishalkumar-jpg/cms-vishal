import * as React from "react";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useWorkflowMutations } from "../hooks/useWorkflows";
import type {
  Workflow,
  WorkflowActionType,
  WorkflowInput,
  WorkflowTriggerType,
} from "../api/workflows.api";

const TRIGGERS: { id: WorkflowTriggerType; label: string; hint: string }[] = [
  { id: "form_submitted", label: "Form submitted", hint: "When a form is submitted" },
  { id: "audience_enters", label: "Audience entered", hint: "When a visitor joins an audience" },
  { id: "score_threshold", label: "Score threshold", hint: "When a lead score crosses N" },
  { id: "page_visited", label: "Page visited", hint: "When a path is viewed" },
];

const ACTIONS: { id: WorkflowActionType; label: string }[] = [
  { id: "adjust_score", label: "Adjust score" },
  { id: "add_to_audience", label: "Add to audience" },
  { id: "add_tag", label: "Add tag" },
  { id: "send_webhook", label: "Send webhook" },
  { id: "enqueue_webhook_event", label: "Emit webhook event" },
  { id: "send_email", label: "Send email" },
  { id: "wait", label: "Wait" },
];

interface EditorAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
}

/**
 * Workflow builder (Phase 5): pick a trigger + configure it, then add ordered
 * actions from a palette with per-action config. A modal dialog mirroring the
 * audiences/experiments editor pattern.
 */
export function WorkflowEditor({
  workflow,
  onClose,
}: {
  workflow: Workflow | null;
  onClose: () => void;
}) {
  const { create, update } = useWorkflowMutations();

  const [name, setName] = useState(workflow?.name ?? "");
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(
    workflow?.trigger.type ?? "form_submitted",
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    workflow?.trigger.config ?? {},
  );
  const [actions, setActions] = useState<EditorAction[]>(
    (workflow?.actions ?? []).map((a) => ({ type: a.type, config: a.config ?? {} })),
  );

  const addAction = (type: WorkflowActionType): void =>
    setActions((prev) => [...prev, { type, config: {} }]);
  const removeAction = (i: number): void => setActions((prev) => prev.filter((_, idx) => idx !== i));
  const moveAction = (i: number, dir: -1 | 1): void =>
    setActions((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const patchAction = (i: number, patch: Record<string, unknown>): void =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, config: { ...a.config, ...patch } } : a)));

  const save = (): void => {
    if (!name.trim() || actions.length === 0) return;
    const data: WorkflowInput = {
      name: name.trim(),
      trigger: { type: triggerType, config: triggerConfig },
      actions: actions.map((a) => ({ type: a.type, config: a.config })),
    };
    if (workflow) update.mutate({ id: workflow.id, data }, { onSuccess: onClose });
    else create.mutate(data, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{workflow ? "Edit workflow" : "New workflow"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Notify sales on hot lead"
            />
          </div>

          {/* Trigger */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <Label>Trigger</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as WorkflowTriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TriggerConfig type={triggerType} config={triggerConfig} onChange={setTriggerConfig} />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Actions</Label>
              <Select value="" onValueChange={(v) => v && addAction(v as WorkflowActionType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Add action…" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {actions.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No actions yet — add one from the palette above.
              </p>
            )}

            {actions.map((a, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {i + 1}. {ACTIONS.find((x) => x.id === a.type)?.label ?? a.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => moveAction(i, -1)} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => moveAction(i, 1)} aria-label="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeAction(i)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ActionConfig type={a.type} config={a.config} onChange={(p) => patchAction(i, p)} />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim() || actions.length === 0 || create.isPending || update.isPending}>
            {workflow ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const TriggerConfig: React.FC<{
  type: WorkflowTriggerType;
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}> = ({ type, config, onChange }) => {
  if (type === "form_submitted") {
    return (
      <Field
        label="Form id (blank = any form)"
        value={str(config.formId)}
        onChange={(v) => onChange({ ...config, formId: v || undefined })}
      />
    );
  }
  if (type === "audience_enters") {
    return (
      <Field
        label="Audience id"
        value={str(config.audienceId)}
        onChange={(v) => onChange({ ...config, audienceId: v })}
      />
    );
  }
  if (type === "score_threshold") {
    return (
      <Field
        label="Threshold"
        type="number"
        value={str(config.threshold)}
        onChange={(v) => onChange({ ...config, threshold: Number(v) })}
      />
    );
  }
  return (
    <Field
      label="Path"
      value={str(config.path)}
      onChange={(v) => onChange({ ...config, path: v })}
      placeholder="/pricing"
    />
  );
};

const ActionConfig: React.FC<{
  type: WorkflowActionType;
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}> = ({ type, config, onChange }) => {
  switch (type) {
    case "adjust_score":
      return (
        <Field
          label="Points (+/-)"
          type="number"
          value={str(config.points)}
          onChange={(v) => onChange({ points: Number(v) })}
        />
      );
    case "add_to_audience":
      return (
        <Field label="Audience id" value={str(config.audienceId)} onChange={(v) => onChange({ audienceId: v })} />
      );
    case "add_tag":
      return <Field label="Tag" value={str(config.tag)} onChange={(v) => onChange({ tag: v })} />;
    case "send_webhook":
      return (
        <div className="space-y-2">
          <Field label="URL" value={str(config.url)} onChange={(v) => onChange({ url: v })} placeholder="https://…" />
          <Field label="Signing secret (optional)" value={str(config.secret)} onChange={(v) => onChange({ secret: v })} />
        </div>
      );
    case "enqueue_webhook_event":
      return (
        <Field label="Event name" value={str(config.event)} onChange={(v) => onChange({ event: v })} placeholder="workflow.event" />
      );
    case "send_email":
      return (
        <div className="space-y-2">
          <Field label="To (blank = identity email)" value={str(config.to)} onChange={(v) => onChange({ to: v })} />
          <Field label="Subject" value={str(config.subject)} onChange={(v) => onChange({ subject: v })} />
        </div>
      );
    case "wait":
      return (
        <Field
          label="Wait seconds"
          type="number"
          value={str(config.waitSeconds)}
          onChange={(v) => onChange({ waitSeconds: Number(v) })}
        />
      );
    default:
      return null;
  }
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}> = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);
