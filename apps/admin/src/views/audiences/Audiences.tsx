import { useState } from "react";
import { Plus, RefreshCw, Trash2, Users2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useAudiences, useAudienceMutations } from "./hooks/useAudiences";
import { AudienceEditor } from "./components/AudienceEditor";
import { MembersDrawer } from "./components/MembersDrawer";
import type { Audience } from "./api/audiences.api";

/**
 * Audiences (Phase 3). Define segments with a visual AND/OR rule builder over
 * profile/identity fields, see a live preview count, save, recompute memberships
 * (worker), and inspect members. Reuses the shared RuleBuilder component.
 */
export function Audiences() {
  const { data, isLoading } = useAudiences();
  const { remove, recompute } = useAudienceMutations();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Audience | null>(null);
  const [creating, setCreating] = useState(false);
  const [membersOf, setMembersOf] = useState<Audience | null>(null);

  const doDelete = (audience: Audience): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${audience.name}"?`,
        description: "This audience segment and its membership data will be permanently removed.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      remove.mutate(audience.id, {
        onSuccess: () => toast.success("Audience deleted"),
        onError: () => toast.error("Could not delete audience"),
      });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Users2 className="h-6 w-6 text-primary" />
            Audiences
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Segment visitors and identities by behaviour, score, source and company.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New audience
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && (data ?? []).length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No audiences yet. Create one to segment your visitors.
        </div>
      )}

      <div className="grid gap-3">
        {(data ?? []).map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
          >
            <button className="text-left" onClick={() => setEditing(a)}>
              <div className="font-medium text-foreground">{a.name}</div>
              {a.description && (
                <div className="text-sm text-muted-foreground">{a.description}</div>
              )}
            </button>
            <div className="flex items-center gap-2">
              <Badge variant="muted">{a.members} members</Badge>
              <Button variant="outline" size="sm" onClick={() => setMembersOf(a)}>
                Members
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Recompute"
                onClick={() => recompute.mutate(a.id)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title={DELETE_CONFIRM_LABEL} onClick={() => doDelete(a)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <AudienceEditor
          audience={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <MembersDrawer audience={membersOf} onClose={() => setMembersOf(null)} />
    </div>
  );
}
