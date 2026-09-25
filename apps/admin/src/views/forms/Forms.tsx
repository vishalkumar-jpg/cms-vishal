import * as React from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Inbox,
  Send,
  Trash2,
  FileText,
  Settings,
  BarChart3,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  DELETE_CANNOT_UNDO_DESCRIPTION,
  DELETE_CONFIRM_LABEL,
  PUBLISH_CONFIRM_LABEL,
} from "@/components/ui/confirm-labels";
import { FORM_PUBLISH_CONFIRM_DESCRIPTION } from "./constants";
import { useSiteStore } from "@/store/siteStore";
import { useForms, useDeleteForm, usePublishForm } from "./hooks/useForms";
import { FormEditorDialog } from "./components/FormEditorDialog";
import { SubmissionsDialog } from "./components/SubmissionsDialog";
import { AnalyticsDialog } from "./components/AnalyticsDialog";
import { CrmConfigDialog } from "./components/CrmConfigDialog";
import type { Form, FormStatus } from "./types";

const STATUS_VARIANT: Record<FormStatus, BadgeProps["variant"]> = {
  draft: "muted",
  published: "success",
  archived: "outline",
};

export const Forms: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [search, setSearch] = React.useState("");
  const [editorFormId, setEditorFormId] = React.useState<string | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [submissionsForm, setSubmissionsForm] = React.useState<Form | null>(null);
  const [analyticsForm, setAnalyticsForm] = React.useState<Form | null>(null);
  const [crmOpen, setCrmOpen] = React.useState(false);

  const { data: forms = [], isLoading, isError } = useForms();
  const del = useDeleteForm();
  const publish = usePublishForm();
  const confirm = useConfirm();

  const filtered = React.useMemo(
    () => forms.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [forms, search],
  );

  const openCreate = (): void => {
    setEditorFormId(null);
    setEditorOpen(true);
  };

  const openEdit = (id: string): void => {
    setEditorFormId(id);
    setEditorOpen(true);
  };

  const doPublish = (form: Form): void => {
    void (async () => {
      const ok = await confirm({
        title: `Publish "${form.name}"?`,
        description: FORM_PUBLISH_CONFIRM_DESCRIPTION,
        confirmLabel: PUBLISH_CONFIRM_LABEL,
      });
      if (!ok) return;
      publish.mutate(form.id, {
        onSuccess: () => toast.success("Form published"),
        onError: () => toast.error("Publish failed"),
      });
    })();
  };

  const doDelete = (form: Form): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${form.name}"?`,
        description: DELETE_CANNOT_UNDO_DESCRIPTION,
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(form.id, {
        onSuccess: () => toast.success("Form deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Build forms, collect submissions, and map them into your CRM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCrmOpen(true)} disabled={!siteId}>
            <Settings className="mr-1.5 h-4 w-4" /> CRM settings
          </Button>
          <Button onClick={openCreate} disabled={!siteId}>
            <Plus className="mr-1.5 h-4 w-4" /> New form
          </Button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search forms…"
          className="pl-9"
        />
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Fields</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow text="Select a site to view its forms." />}
            {siteId && isLoading && <EmptyRow text="Loading forms…" />}
            {siteId && isError && <EmptyRow text="Could not load forms." />}
            {siteId && !isLoading && !isError && filtered.length === 0 && (
              <EmptyRow text="No forms yet. Create your first form." />
            )}
            {filtered.map((form) => (
              <FormRow
                key={form.id}
                form={form}
                onEdit={() => openEdit(form.id)}
                onSubmissions={() => setSubmissionsForm(form)}
                onAnalytics={() => setAnalyticsForm(form)}
                onPublish={() => doPublish(form)}
                onDelete={() => doDelete(form)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <FormEditorDialog
        formId={editorFormId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
      <SubmissionsDialog
        form={submissionsForm}
        open={!!submissionsForm}
        onOpenChange={(open) => {
          if (!open) setSubmissionsForm(null);
        }}
      />
      <AnalyticsDialog
        form={analyticsForm}
        open={!!analyticsForm}
        onOpenChange={(open) => {
          if (!open) setAnalyticsForm(null);
        }}
      />
      <CrmConfigDialog open={crmOpen} onOpenChange={setCrmOpen} />
    </div>
  );
};

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <tr>
    <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
      <FileText className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {text}
    </td>
  </tr>
);

const FormRow: React.FC<{
  form: Form;
  onEdit: () => void;
  onSubmissions: () => void;
  onAnalytics: () => void;
  onPublish: () => void;
  onDelete: () => void;
}> = ({ form, onEdit, onSubmissions, onAnalytics, onPublish, onDelete }) => (
  <tr className="hover:bg-muted/30">
    <td className="cursor-pointer px-4 py-3 font-medium" onClick={onEdit}>
      {form.name}
    </td>
    <td className="px-4 py-3">
      <Badge variant={STATUS_VARIANT[form.status]}>{form.status}</Badge>
    </td>
    <td className="px-4 py-3 text-muted-foreground">{form.fields.length}</td>
    <td className="px-4 py-3 text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSubmissions}>
            <Inbox className="h-4 w-4" /> View submissions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAnalytics}>
            <BarChart3 className="h-4 w-4" /> Analytics
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPublish} disabled={form.status === "published"}>
            <Send className="h-4 w-4" /> Publish
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  </tr>
);
