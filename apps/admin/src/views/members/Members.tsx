import * as React from "react";
import { UserPlus, Trash2, Users, Mail, Send, Copy } from "lucide-react";
import { ROLES, type Role } from "@ob-cms/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { REMOVE_CONFIRM_LABEL, REVOKE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "./hooks/useMembers";
import {
  useInvitations,
  useCreateInvitation,
  useResendInvitation,
  useRevokeInvitation,
} from "./hooks/useInvitations";
import { useRoles, useAssignCustomRole } from "@/views/roles/hooks/useRoles";
import type { SiteMemberView } from "./api/members.api";
import type { Invitation } from "./api/invitations.api";

/** Roles that may be invited/assigned through the admin UI (super_admin is platform-only). */
const INVITABLE_ROLES = ROLES.filter((r) => r !== "super_admin");

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  site_admin: "Site admin",
  editor: "Editor",
  contributor: "Contributor",
};

const memberName = (m: SiteMemberView): string => {
  const u = m.user;
  if (u?.firstName || u?.lastName) return [u.firstName, u.lastName].filter(Boolean).join(" ");
  return u?.email ?? m.userId;
};

/** Site team management (per-site, via /sites/:siteId/members). */
export const Members: React.FC = () => {
  const { activeSite } = useActiveSite();
  const { data: members = [], isLoading, isError } = useMembers();
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const confirm = useConfirm();
  const [addOpen, setAddOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Team for <span className="font-medium">{activeSite?.name ?? "this website"}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setInviteOpen(true)} disabled={!activeSite}>
            <Mail className="mr-1.5 h-4 w-4" /> Invite by email
          </Button>
          <Button onClick={() => setAddOpen(true)} disabled={!activeSite}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Add member
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Site members
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-y border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Custom role</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading members…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Could not load members.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No members yet. Add your first teammate.
                  </td>
                </tr>
              )}
              {members.map((m) => (
                <tr key={m.id ?? m.userId} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{memberName(m)}</div>
                    {m.user?.email && (
                      <div className="text-xs text-muted-foreground">{m.user.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        updateRole.mutate(
                          { userId: m.userId, role: v as Role },
                          {
                            onSuccess: () => toast.success("Role updated"),
                            onError: () => toast.error("Could not update role"),
                          },
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <CustomRoleCell member={m} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      title={`${REMOVE_CONFIRM_LABEL} member`}
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: `Remove "${memberName(m)}"?`,
                            description: "This member will lose access to this site.",
                            confirmLabel: REMOVE_CONFIRM_LABEL,
                            destructive: true,
                          });
                          if (!ok) return;
                          remove.mutate(m.userId, {
                            onSuccess: () => toast.success("Member removed"),
                            onError: () => toast.error("Could not remove member"),
                          });
                        })();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Roles:{" "}
        {ROLES.map((r, i) => (
          <span key={r}>
            {i > 0 && ", "}
            <Badge variant="outline" className="mx-0.5">
              {ROLE_LABELS[r]}
            </Badge>
          </span>
        ))}
      </p>

      <PendingInvitations />

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
};

const NO_CUSTOM_ROLE = "__none__";

/**
 * RBAC-2: assign (or clear) a member's custom role, and show its effective
 * permission count. A custom role OVERRIDES the built-in role's default
 * permission set for the fine-grained @RequirePermissions gate.
 */
const CustomRoleCell: React.FC<{ member: SiteMemberView }> = ({ member }) => {
  const { data: roles } = useRoles();
  const assign = useAssignCustomRole();
  const custom = roles?.custom ?? [];
  const value = member.customRoleId ?? NO_CUSTOM_ROLE;
  const permCount = member.permissions?.length ?? 0;

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={value}
        onValueChange={(v) =>
          assign.mutate(
            { userId: member.userId, customRoleId: v === NO_CUSTOM_ROLE ? null : v },
            {
              onSuccess: () => toast.success("Custom role updated"),
              onError: () => toast.error("Could not update custom role"),
            },
          )
        }
      >
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Built-in default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CUSTOM_ROLE}>Built-in default</SelectItem>
          {custom.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-[10px] text-muted-foreground">{permCount} effective permissions</span>
    </div>
  );
};

const INVITE_STATUS_VARIANT: Record<Invitation["status"], "outline" | "muted"> = {
  pending: "outline",
  accepted: "muted",
  revoked: "muted",
  expired: "muted",
};

/** Pending (and recent) invitations with resend + revoke actions. */
const PendingInvitations: React.FC = () => {
  const { data: invitations = [], isLoading } = useInvitations();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const confirm = useConfirm();

  const copyLink = (url: string): void => {
    void navigator.clipboard?.writeText(url);
    toast.success("Invite link copied");
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" /> Pending invitations
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading invitations…
                </td>
              </tr>
            )}
            {!isLoading && invitations.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No invitations yet.
                </td>
              </tr>
            )}
            {invitations.map((inv) => (
              <tr key={inv.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{inv.email}</td>
                <td className="px-4 py-3">{ROLE_LABELS[inv.role]}</td>
                <td className="px-4 py-3">
                  <Badge variant={INVITE_STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Copy invite link"
                      onClick={() => copyLink(inv.acceptUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {inv.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Resend invitation"
                          disabled={resend.isPending}
                          onClick={() =>
                            resend.mutate(inv.id, {
                              onSuccess: () => toast.success("Invitation resent"),
                              onError: () => toast.error("Could not resend invitation"),
                            })
                          }
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title={`${REVOKE_CONFIRM_LABEL} invitation`}
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({
                                title: `Revoke invitation for "${inv.email}"?`,
                                description: "This invite link will stop working immediately.",
                                confirmLabel: REVOKE_CONFIRM_LABEL,
                                destructive: true,
                              });
                              if (!ok) return;
                              revoke.mutate(inv.id, {
                                onSuccess: () => toast.success("Invitation revoked"),
                                onError: () => toast.error("Could not revoke invitation"),
                              });
                            })();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

/** Invite a teammate by email. Sends a tokenized accept link (shown for dev). */
const InviteDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const create = useCreateInvitation();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("contributor");

  React.useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("contributor");
    }
  }, [open]);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!email.trim()) return;
    create.mutate(
      { email: email.trim(), role },
      {
        onSuccess: (inv) => {
          toast.success(`Invitation sent to ${inv.email}`);
          void navigator.clipboard?.writeText(inv.acceptUrl);
          onOpenChange(false);
        },
        onError: () => toast.error("Could not send invitation"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite by email</DialogTitle>
          <DialogDescription>
            Send an email invitation. The recipient sets a password and joins this website.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              autoFocus
              placeholder="teammate@company.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email.trim() || create.isPending}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Add a member to the site. The API's AddMemberDto takes a `userId` + `role`
 * (the platform has no public user-search endpoint in the admin yet — see
 * WAVE-CMS-COMPLETE.md), so we collect the user id directly.
 */
const AddMemberDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const add = useAddMember();
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState<Role>("contributor");

  React.useEffect(() => {
    if (!open) {
      setUserId("");
      setRole("contributor");
    }
  }, [open]);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!userId.trim()) return;
    add.mutate(
      { userId: userId.trim(), role },
      {
        onSuccess: () => {
          toast.success("Member added");
          onOpenChange(false);
        },
        onError: () => toast.error("Could not add member. Check the user id."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Add an existing user to this website and assign their role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="member-user-id">User id</Label>
            <Input
              id="member-user-id"
              value={userId}
              autoFocus
              placeholder="usr_…"
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!userId.trim() || add.isPending}>
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
