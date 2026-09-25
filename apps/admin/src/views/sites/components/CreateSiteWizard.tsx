import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Loader2, Check } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
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
import { useCreateSite } from "../hooks/useSites";
import { listOrganizationsRequest, type Organization } from "../api/organizations.api";
import { getPlatformBaseDomain } from "@/views/builder/lib/siteUrl";

/** lowercase / hyphen subdomain slugifier (matches the API slug regex). */
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

/**
 * Website creation wizard (ported UX from the POC WebsiteWizard): name →
 * subdomain → create. On success the new site is auto-selected (handled by
 * `useCreateSite`). Works both as a first-run gate (forceOpen) and a switcher
 * action.
 */
export const CreateSiteWizard: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true the dialog cannot be dismissed (first-run, zero sites). */
  mandatory?: boolean;
  onCreated?: (siteId: string) => void;
}> = ({ open, onOpenChange, mandatory = false, onCreated }) => {
  const create = useCreateSite();
  const platformBase = getPlatformBaseDomain();
  const [name, setName] = React.useState("");
  const [subdomain, setSubdomain] = React.useState("");
  const [touchedSub, setTouchedSub] = React.useState(false);
  const [orgId, setOrgId] = React.useState<string>("");

  // Owning organization. Only super_admins reach this wizard, so listing orgs
  // is allowed. One org → attach silently; several → show a picker defaulting
  // to the OLDEST org (the seeded primary org on this deployment). On fetch
  // failure we omit orgId and let the API's server-side resolution try.
  const orgsQuery = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: listOrganizationsRequest,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const orgs = React.useMemo(
    () =>
      [...(orgsQuery.data ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [orgsQuery.data],
  );
  React.useEffect(() => {
    if (orgs.length > 0 && !orgs.some((o) => o.id === orgId)) setOrgId(orgs[0].id);
  }, [orgs, orgId]);

  // Auto-derive subdomain from name until the user edits it directly.
  React.useEffect(() => {
    if (!touchedSub) setSubdomain(slugify(name));
  }, [name, touchedSub]);

  // Reset on close.
  React.useEffect(() => {
    if (!open) {
      setName("");
      setSubdomain("");
      setTouchedSub(false);
      setOrgId("");
    }
  }, [open]);

  const subValid = SUBDOMAIN_RE.test(subdomain);
  const canSubmit = name.trim().length >= 2 && subValid && !create.isPending;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const site = await create.mutateAsync({
        name: name.trim(),
        slug: subdomain,
        subdomain,
        // Omit when the org list didn't load — the API auto-resolves then.
        ...(orgId ? { orgId } : {}),
      });
      toast.success("Website created");
      onOpenChange(false);
      if (site?.id) onCreated?.(site.id);
    } catch (err) {
      // Surface the API's message (subdomain taken, reserved, org needed, ...).
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message;
      toast.error(
        Array.isArray(msg) ? msg[0] : (msg ?? "Could not create website. Please try again."),
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (mandatory && !o) return; // can't dismiss the first-run gate
        onOpenChange(o);
      }}
    >
      <DialogContent
        onPointerDownOutside={(e) => mandatory && e.preventDefault()}
        onEscapeKeyDown={(e) => mandatory && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {mandatory ? "Create your first website" : "New website"}
          </DialogTitle>
          <DialogDescription>
            Give your website a name and a subdomain. You can change these later in settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site-name">Website name</Label>
            <Input
              id="site-name"
              value={name}
              autoFocus
              placeholder="Acme Marketing"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site-subdomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="site-subdomain"
                value={subdomain}
                placeholder="acme"
                onChange={(e) => {
                  setTouchedSub(true);
                  setSubdomain(slugify(e.target.value));
                }}
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                {platformBase ? `.${platformBase}` : ""}
              </span>
            </div>
            {subdomain && !subValid && (
              <span className="text-xs text-destructive">
                Lowercase letters, numbers, and hyphens only.
              </span>
            )}
            {subValid && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3 w-3 text-emerald-500" /> {subdomain}
                {platformBase ? `.${platformBase}` : ""}
              </span>
            )}
          </div>

          {/* Only surfaced when the platform has several orgs — the common
              single-org case attaches the org silently. */}
          {orgs.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="site-org">Organization</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger id="site-org">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            {!mandatory && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!canSubmit}>
              {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create website
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
