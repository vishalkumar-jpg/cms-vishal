import * as React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button, Input, Label, Switch } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import {
  RuleBuilder,
  conditionalToGroup,
  groupToConditional,
  type RuleField,
  type RuleGroup,
} from "@/components/rule-builder";
import { useForm, useCreateForm, useUpdateForm } from "../hooks/useForms";
import {
  FORM_FIELD_TYPES,
  type FormField,
  type FormFieldOption,
  type FormFieldType,
  type FormSettings,
} from "../types";

const TYPES_WITH_OPTIONS: ReadonlySet<FormFieldType> = new Set([
  "select",
  "multiselect",
  "radio",
]);

/** Machine name from a label: lowercase, non-alphanumeric → "_". */
const deriveName = (label: string): string =>
  label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const newField = (): FormField => ({
  type: "text",
  label: "",
  name: "",
  required: false,
  placeholder: "",
  step: 0,
});

export const FormEditorDialog: React.FC<{
  formId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ formId, open, onOpenChange }) => {
  const isEdit = !!formId;
  const { data: existing } = useForm(open ? formId : null);
  const create = useCreateForm();
  const update = useUpdateForm();

  const [name, setName] = React.useState("");
  const [fields, setFields] = React.useState<FormField[]>([]);
  const [settings, setSettings] = React.useState<FormSettings>({});

  // Seed state when the dialog opens (create → blank, edit → fetched row).
  React.useEffect(() => {
    if (!open) return;
    if (isEdit && existing) {
      setName(existing.name);
      setFields(existing.fields.map((f) => ({ ...f })));
      setSettings({ ...(existing.settings as FormSettings) });
    } else if (!isEdit) {
      setName("");
      setFields([]);
      setSettings({});
    }
  }, [open, isEdit, existing]);

  const patchField = (index: number, patch: Partial<FormField>): void => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const removeField = (index: number): void => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const moveField = (index: number, dir: -1 | 1): void => {
    setFields((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  // Step labels — array length defines the number of steps (min 1).
  const stepLabels = settings.steps && settings.steps.length > 0 ? settings.steps : ["Step 1"];
  const setSteps = (steps: string[]): void => setSettings((s) => ({ ...s, steps }));
  // Selectable fields for a row's conditional rule builder: every OTHER named
  // field, carrying its type so the builder can filter operators.
  const ruleFields: RuleField[] = fields
    .filter((f) => f.name.trim())
    .map((f) => ({ name: f.name.trim(), label: f.label || f.name.trim(), type: f.type }));

  const onSave = async (): Promise<void> => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    // Backfill machine names from labels where left blank.
    const normalized = fields.map((f) => ({
      ...f,
      name: f.name.trim() || deriveName(f.label),
    }));
    // Drop an empty conditional rule (no field selected) before persisting.
    const cleaned = normalized.map((f) =>
      f.conditional && !f.conditional.field ? { ...f, conditional: undefined } : f,
    );
    try {
      const payload = { name: name.trim(), fields: cleaned, settings };
      if (isEdit && formId) {
        await update.mutateAsync({ id: formId, payload });
        toast.success("Form updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Form created");
      }
      onOpenChange(false);
    } catch {
      toast.error(isEdit ? "Could not update form" : "Could not create form");
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit form" : "New form"}</DialogTitle>
          <DialogDescription>
            Define fields, group them into steps, add conditional logic, and configure
            post-submit behaviour.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="form-name">Name</Label>
          <Input
            id="form-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact us"
            autoFocus
          />
        </div>

        <Tabs defaultValue="fields" className="mt-2">
          <TabsList>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFields((prev) => [...prev, newField()])}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add field
              </Button>
            </div>

            {fields.length === 0 && (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No fields yet. Add your first field.
              </p>
            )}

            {fields.map((field, index) => (
              <FieldRow
                key={index}
                field={field}
                index={index}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
                stepCount={stepLabels.length}
                otherFields={ruleFields.filter((f) => f.name !== field.name.trim())}
                onChange={(patch) => patchField(index, patch)}
                onRemove={() => removeField(index)}
                onMoveUp={() => moveField(index, -1)}
                onMoveDown={() => moveField(index, 1)}
              />
            ))}
          </TabsContent>

          <TabsContent value="steps" className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Define one or more steps, then assign each field to a step on the Fields tab.
              A single step renders as a normal form.
            </p>
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
                <Input
                  value={label}
                  onChange={(e) =>
                    setSteps(stepLabels.map((l, li) => (li === i ? e.target.value : l)))
                  }
                  placeholder={`Step ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive"
                  disabled={stepLabels.length <= 1}
                  onClick={() => setSteps(stepLabels.filter((_, li) => li !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => setSteps([...stepLabels, `Step ${stepLabels.length + 1}`])}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add step
            </Button>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel settings={settings} onChange={setSettings} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={pending}>
            {isEdit ? "Save changes" : "Create form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SettingsPanel: React.FC<{
  settings: FormSettings;
  onChange: React.Dispatch<React.SetStateAction<FormSettings>>;
}> = ({ settings, onChange }) => {
  const patch = (p: Partial<FormSettings>): void => onChange((s) => ({ ...s, ...p }));
  const successMode = settings.successMode ?? "message";
  const notifyText = (settings.notifyEmails ?? []).join(", ");
  const captchaOn = settings.spamProtection?.captcha === true;

  const setCaptcha = (on: boolean): void =>
    onChange((s) => ({ ...s, spamProtection: { ...s.spamProtection, captcha: on } }));

  const setNotify = (raw: string): void =>
    patch({
      notifyEmails: raw
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0),
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Thank-you behaviour</Label>
        <Select
          value={successMode}
          onValueChange={(v) => patch({ successMode: v as "message" | "redirect" })}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="message">Show a thank-you message</SelectItem>
            <SelectItem value="redirect">Redirect to a URL</SelectItem>
          </SelectContent>
        </Select>
        {successMode === "message" ? (
          <Textarea
            value={settings.successMessage ?? ""}
            onChange={(e) => patch({ successMessage: e.target.value })}
            placeholder="Thanks — we'll be in touch shortly."
            rows={2}
          />
        ) : (
          <Input
            value={settings.redirectUrl ?? ""}
            onChange={(e) => patch({ redirectUrl: e.target.value })}
            placeholder="https://example.com/thank-you"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Notification emails</Label>
        <Textarea
          value={notifyText}
          onChange={(e) => setNotify(e.target.value)}
          placeholder="alerts@acme.com, sales@acme.com"
          rows={2}
        />
        <p className="text-xs text-muted-foreground">
          Comma- or newline-separated. Each gets an email with the submitted data on every
          submission.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <div>
          <Label>Captcha (Cloudflare Turnstile)</Label>
          <p className="text-xs text-muted-foreground">
            Verified server-side when Turnstile keys are configured; otherwise the honeypot is
            used.
          </p>
        </div>
        <Switch checked={captchaOn} onCheckedChange={setCaptcha} />
      </div>
    </div>
  );
};

const FieldRow: React.FC<{
  field: FormField;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  stepCount: number;
  otherFields: RuleField[];
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}> = ({ field, isFirst, isLast, stepCount, otherFields, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const showOptions = TYPES_WITH_OPTIONS.has(field.type);

  const setOptions = (options: FormFieldOption[]): void => onChange({ options });
  const options = field.options ?? [];

  const setValidation = (patch: Partial<NonNullable<FormField["validation"]>>): void =>
    onChange({ validation: { ...field.validation, ...patch } });
  const validation = field.validation ?? {};

  // Bridge the server's single-condition `conditional` shape to the visual
  // RuleBuilder's group model, then flatten back on every edit. The server only
  // evaluates one `{field, op, value}` rule, so the builder is a nicer UI over
  // that same shape (see components/rule-builder/forms-adapter.ts).
  const ruleGroup: RuleGroup = conditionalToGroup(field.conditional);
  const setRuleGroup = (next: RuleGroup): void =>
    onChange({ conditional: groupToConditional(next) });
  const hasRule = !!field.conditional?.field;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={field.type}
              onValueChange={(v) => onChange({ type: v as FormFieldType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={field.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={field.label ? deriveName(field.label) : "full_name"}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Placeholder</Label>
            <Input
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isFirst}
            onClick={onMoveUp}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isLast}
            onClick={onMoveDown}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={!!field.required}
            onCheckedChange={(checked) => onChange({ required: checked })}
          />
          <Label className="text-xs">Required</Label>
        </div>
        {stepCount > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Step</Label>
            <Select
              value={String(field.step ?? 0)}
              onValueChange={(v) => onChange({ step: Number(v) })}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: stepCount }).map((_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    Step {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {showOptions && (
        <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Options</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setOptions([...options, { label: "", value: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add option
            </Button>
          </div>
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground">No options yet.</p>
          )}
          {options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <Input
                value={opt.label}
                onChange={(e) =>
                  setOptions(options.map((o, i) => (i === oi ? { ...o, label: e.target.value } : o)))
                }
                placeholder="Label"
                className="h-8"
              />
              <Input
                value={opt.value}
                onChange={(e) =>
                  setOptions(options.map((o, i) => (i === oi ? { ...o, value: e.target.value } : o)))
                }
                placeholder="Value"
                className="h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 shrink-0 text-destructive")}
                onClick={() => setOptions(options.filter((_, i) => i !== oi))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <details className="rounded-md bg-muted/40 px-2 py-1.5 text-sm" open={hasRule}>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Conditional logic
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Show this field only when another field matches a rule. The first
            condition is what gets saved (the server evaluates a single rule).
          </p>
          {otherFields.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
              Add other named fields first to build a rule.
            </p>
          ) : (
            <RuleBuilder
              fields={otherFields}
              value={ruleGroup}
              onChange={setRuleGroup}
            />
          )}
        </div>
      </details>

      <details className="rounded-md bg-muted/40 px-2 py-1.5 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">Validation</summary>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Min length</Label>
            <Input
              type="number"
              value={validation.minLength ?? ""}
              onChange={(e) =>
                setValidation({
                  minLength: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Max length</Label>
            <Input
              type="number"
              value={validation.maxLength ?? ""}
              onChange={(e) =>
                setValidation({
                  maxLength: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Pattern</Label>
            <Input
              value={validation.pattern ?? ""}
              onChange={(e) =>
                setValidation({ pattern: e.target.value === "" ? undefined : e.target.value })
              }
              className="h-8"
            />
          </div>
        </div>
      </details>
    </div>
  );
};
