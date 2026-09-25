import * as React from "react";
import { ShieldCheck, Plus, Pencil, Trash2, Lock } from "lucide-react";
import type { Role } from "@ob-cms/shared";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import {
  usePermissionCatalog,
  useRoles,
  useCreateCustomRole,
  useUpdateCustomRole,
  useDeleteCustomRole,
} from "./hooks/useRoles";
import type { CustomRole, PermissionGroup } from "./api/roles.api";

const BUILTIN_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  site_admin: "Site admin",
  editor: "Editor",
  contributor: "Contributor",
};

/** RBAC-2: Roles & Permissions manager — built-in + custom roles for the site. */
export const Roles: React.FC = () => {
  const { activeSite } = useActiveSite();
  const { data: roles, isLoading, isError } = useRoles();
  const del = useDeleteCustomRole();
  const confirm = useConfirm();
  const [editing, setEditing] = React.useState<CustomRole | null>(null);
  const [creating, setCreating] = React.useState(false);

  const doDelete = (role: CustomRole): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete role "${role.name}"?`,
        description: "Members assigned this custom role will fall back to their built-in role permissions.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(role.id, {
        onSuccess: () => toast.success("Role deleted"),
        onError: () => toast.error("Could not delete role"),
      });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Built-in roles plus custom roles for{" "}
            <span className="font-medium">{activeSite?.name ?? "this website"}</span>.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!activeSite}>
          <Plus className="mr-1.5 h-4 w-4" /> New role
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> Built-in roles
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(roles?.builtin ?? []).map((b) => (
            <div key={b.role} className="rounded-md border border-border p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-medium">{BUILTIN_LABELS[b.role]}</span>
                <Badge variant="muted">Built-in</Badge>
                <span className="text-xs text-muted-foreground">
                  {b.permissions.length} permissions
                </span>
              </div>
              <PermissionPills permissions={b.permissions} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Custom roles
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading roles…</p>}
          {isError && <p className="text-sm text-muted-foreground">Could not load roles.</p>}
          {!isLoading && !isError && (roles?.custom.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              No custom roles yet. Create one to grant a fine-grained permission set.
            </p>
          )}
          {(roles?.custom ?? []).map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.permissions.length} permissions
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Edit role"
                    onClick={() => setEditing(r)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title={DELETE_CONFIRM_LABEL}
                    onClick={() => doDelete(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {r.description && (
                <p className="mb-1.5 text-xs text-muted-foreground">{r.description}</p>
              )}
              <PermissionPills permissions={r.permissions} />
            </div>
          ))}
        </CardContent>
      </Card>

      <RoleDialog
        open={creating || !!editing}
        role={editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </div>
  );
};

const PermissionPills: React.FC<{ permissions: string[] }> = ({ permissions }) => (
  <div className="flex flex-wrap gap-1">
    {permissions.slice(0, 24).map((p) => (
      <span
        key={p}
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
      >
        {p}
      </span>
    ))}
    {permissions.length > 24 && (
      <span className="text-[10px] text-muted-foreground">
        +{permissions.length - 24} more
      </span>
    )}
  </div>
);

/** Create/edit a custom role with a domain-grouped permission checklist. */
const RoleDialog: React.FC<{
  open: boolean;
  role: CustomRole | null;
  onOpenChange: (open: boolean) => void;
}> = ({ open, role, onOpenChange }) => {
  const { data: catalog = [] } = usePermissionCatalog();
  const create = useCreateCustomRole();
  const update = useUpdateCustomRole();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
      setSelected(new Set(role?.permissions ?? []));
    }
  }, [open, role]);

  const toggle = (perm: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });

  const toggleGroup = (group: PermissionGroup): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = group.permissions.every((p) => next.has(p));
      group.permissions.forEach((p) => (allOn ? next.delete(p) : next.add(p)));
      return next;
    });

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: [...selected],
    };
    const opts = {
      onSuccess: () => {
        toast.success(role ? "Role updated" : "Role created");
        onOpenChange(false);
      },
      onError: () => toast.error("Could not save role"),
    };
    if (role) update.mutate({ roleId: role.id, payload }, opts);
    else create.mutate(payload, opts);
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit custom role" : "New custom role"}</DialogTitle>
          <DialogDescription>
            Give the role a name and select the permissions it grants.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              autoFocus
              placeholder="e.g. Blog editor"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-desc">Description (optional)</Label>
            <Textarea
              id="role-desc"
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Label>Permissions ({selected.size} selected)</Label>
            {catalog.map((group) => {
              const allOn = group.permissions.every((p) => selected.has(p));
              return (
                <div key={group.domain} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{group.label}</span>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => toggleGroup(group)}
                    >
                      {allOn ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm}
                        className="flex cursor-pointer items-center gap-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                          checked={selected.has(perm)}
                          onChange={() => toggle(perm)}
                        />
                        <span className="font-mono text-muted-foreground">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {role ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
