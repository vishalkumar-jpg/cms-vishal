import * as React from "react";
import {
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useSiteStore } from "@/store/siteStore";
import { RedirectDialog } from "./components/RedirectDialog";
import { ImportRedirectsDialog } from "./components/ImportRedirectsDialog";
import { useRedirects, useDeleteRedirect } from "./hooks/useRedirects";
import type { Redirect } from "./types";

export const Redirects: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [search, setSearch] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Redirect | null>(null);

  const { data: redirects = [], isLoading, isError } = useRedirects();
  const del = useDeleteRedirect();
  const confirm = useConfirm();

  const doDelete = (redirect: Redirect): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete redirect "${redirect.fromPath}"?`,
        description: "Visitors will no longer be forwarded from this path. This action cannot be undone.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(redirect.id, {
        onSuccess: () => toast.success("Redirect deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  const filtered = React.useMemo(
    () =>
      redirects.filter(
        (r) =>
          r.fromPath.toLowerCase().includes(search.toLowerCase()) ||
          r.toPath.toLowerCase().includes(search.toLowerCase()),
      ),
    [redirects, search],
  );

  const openCreate = (): void => {
    setEditing(null);
    setEditOpen(true);
  };

  const openEdit = (redirect: Redirect): void => {
    setEditing(redirect);
    setEditOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Redirects</h1>
          <p className="text-sm text-muted-foreground">
            Forward old paths to new locations for this site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!siteId}>
            <Upload className="mr-1.5 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={openCreate} disabled={!siteId}>
            <Plus className="mr-1.5 h-4 w-4" /> New redirect
          </Button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search redirects…"
          className="pl-9"
        />
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium">Status code</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow text="Select a site to view its redirects." />}
            {siteId && isLoading && <EmptyRow text="Loading redirects…" />}
            {siteId && isError && <EmptyRow text="Could not load redirects." />}
            {siteId && !isLoading && !isError && filtered.length === 0 && (
              <EmptyRow text="No redirects yet. Create your first redirect." />
            )}
            {filtered.map((redirect) => (
              <RedirectRow
                key={redirect.id}
                redirect={redirect}
                onEdit={() => openEdit(redirect)}
                onDelete={() => doDelete(redirect)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <RedirectDialog redirect={editing} open={editOpen} onOpenChange={setEditOpen} />
      <ImportRedirectsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
};

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <tr>
    <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
      <ArrowRightLeft className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {text}
    </td>
  </tr>
);

const RedirectRow: React.FC<{
  redirect: Redirect;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ redirect, onEdit, onDelete }) => (
  <tr className="hover:bg-muted/30">
    <td className="px-4 py-3 font-medium">{redirect.fromPath}</td>
    <td className="px-4 py-3 text-muted-foreground">{redirect.toPath}</td>
    <td className="px-4 py-3">
      <Badge variant="muted">{redirect.statusCode}</Badge>
    </td>
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
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" /> {DELETE_CONFIRM_LABEL}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  </tr>
);
