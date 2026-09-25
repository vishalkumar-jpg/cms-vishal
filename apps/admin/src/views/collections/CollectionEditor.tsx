import * as React from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import { useCollection, useUpdateCollection } from "./hooks/useCollections";
import { ItemsManager } from "./components/ItemsManager";
import { slugify } from "./slug";
import { COLLECTION_FIELD_TYPES, type CollectionField, type CollectionFieldType } from "./types";

/**
 * Collection editor — two tabs:
 *  - Fields: define the field schema (add/remove/reorder; key/label/type/required).
 *  - Items: the per-collection item manager (create/edit/publish/delete).
 */
export const CollectionEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: collection, isLoading } = useCollection(id ?? null);
  const update = useUpdateCollection();

  if (!siteId) {
    return <Centered text="Select a site first." />;
  }
  if (isLoading || !collection) {
    return <Centered text={isLoading ? "Loading collection…" : "Collection not found."} />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <button
        type="button"
        onClick={() => navigate("/collections")}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Collections
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{collection.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">/{collection.slug}</p>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="pt-4">
          <ItemsManager collection={collection} />
        </TabsContent>
        <TabsContent value="fields" className="pt-4">
          <FieldSchemaEditor
            initial={collection.fields}
            saving={update.isPending}
            onSave={(fields) =>
              update.mutate(
                { id: collection.id, payload: { fields } },
                {
                  onSuccess: () => toast.success("Fields saved"),
                  onError: () => toast.error("Save failed (duplicate key?)"),
                },
              )
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const FieldSchemaEditor: React.FC<{
  initial: CollectionField[];
  saving: boolean;
  onSave: (fields: CollectionField[]) => void;
}> = ({ initial, saving, onSave }) => {
  const [fields, setFields] = React.useState<CollectionField[]>(initial);

  React.useEffect(() => setFields(initial), [initial]);

  const setField = (idx: number, patch: Partial<CollectionField>): void => {
    setFields((f) => f.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };
  const move = (idx: number, dir: -1 | 1): void => {
    const t = idx + dir;
    if (t < 0 || t >= fields.length) return;
    setFields((f) => {
      const next = [...f];
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  };
  const remove = (idx: number): void => setFields((f) => f.filter((_, i) => i !== idx));
  const add = (): void =>
    setFields((f) => [...f, { key: "", label: "", type: "text", required: false }]);

  const dup = new Set<string>();
  let hasDup = false;
  for (const f of fields) {
    if (f.key && dup.has(f.key)) hasDup = true;
    if (f.key) dup.add(f.key);
  }
  const valid = fields.every((f) => f.key.trim() && f.label.trim()) && !hasDup;

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No fields yet. Add fields to describe each item (e.g. title, image, excerpt).
        </p>
      )}
      {fields.map((field, idx) => (
        <div key={idx} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, -1)} title="Move up">
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, 1)} title="Move down">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => remove(idx)}
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Label</Label>
              <Input
                value={field.label}
                onChange={(e) => {
                  const label = e.target.value;
                  const autoKey = !field.key || field.key === slugify(field.label).replace(/-/g, "_");
                  setField(idx, autoKey ? { label, key: slugify(label).replace(/-/g, "_") } : { label });
                }}
                placeholder="Title"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Key</Label>
              <Input
                value={field.key}
                onChange={(e) => setField(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                placeholder="title"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Type</Label>
              <Select value={field.type} onValueChange={(v) => setField(idx, { type: v as CollectionFieldType })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLECTION_FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-between gap-2 pb-1">
              <Label className="text-[11px]">Required</Label>
              <Switch checked={!!field.required} onCheckedChange={(c) => setField(idx, { required: c })} />
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add field
        </Button>
        <div className="flex items-center gap-2">
          {hasDup && <span className="text-xs text-destructive">Duplicate keys</span>}
          <Button disabled={!valid || saving} onClick={() => onSave(fields)}>
            <Save className="mr-1.5 h-4 w-4" /> Save fields
          </Button>
        </div>
      </div>
    </div>
  );
};

const Centered: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{text}</div>
);
