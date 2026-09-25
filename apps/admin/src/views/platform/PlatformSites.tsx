import * as React from "react";
import { useNavigate } from "react-router";
import { Globe, Plus, Loader2, Check, ExternalLink, Pause, Play } from "lucide-react";
import { Button, Input, Card, CardContent, Badge } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useSiteStore } from "@/store/siteStore";
import {
  usePlatformSites,
  usePlatformCreateSite,
  usePlatformSuspendSite,
  usePlatformActivateSite,
} from "./hooks/usePlatform";
import type { PlatformSite } from "./api/platform.api";
import { getPlatformBaseDomain } from "@/views/builder/lib/siteUrl";

const PLATFORM_SITE_STATUS_SUSPENDED = "suspended" as const;

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

/** All sites across every tenant + create / suspend / activate / open actions. */
export const PlatformSites: React.FC = () => {
  const { data: sites = [], isLoading, isError } = usePlatformSites();
  const suspend = usePlatformSuspendSite();
  const activate = usePlatformActivateSite();
  const setActiveSiteId = useSiteStore((s) => s.setActiveSiteId);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = React.useState(false);
  const confirm = useConfirm();
  // Same base domain for every row on this page — resolve once.
  const platformBase = getPlatformBaseDomain();

  const openSite = (site: PlatformSite): void => {
    // Reuse the SiteSwitcher mechanism: set the active site, then enter normal admin.
    setActiveSiteId(site.id);
    navigate("/dashboard");
  };

  const toggleStatus = (site: PlatformSite): void => {
    if (site.status === PLATFORM_SITE_STATUS_SUSPENDED) {
      activate.mutate(site.id, {
        onSuccess: () => toast.success("Site activated"),
        onError: () => toast.error("Could not update site status"),
      });
      return;
    }
    void (async () => {
      const ok = await confirm({
        title: `Suspend "${site.name}"?`,
        description: "This site will become unavailable to visitors until it is activated again.",
        confirmLabel: "Suspend",
        destructive: true,
      });
      if (!ok) return;
      suspend.mutate(site.id, {
        onSuccess: () => toast.success("Site suspended"),
        onError: () => toast.error("Could not update site status"),
      });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sites</h1>
          <p className="text-sm text-muted-foreground">
            Every website on the platform ({sites.length}).
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Create site
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Pages</th>
                <th className="px-4 py-2.5 font-medium">Published</th>
                <th className="px-4 py-2.5 font-medium">Members</th>
                <th className="px-4 py-2.5 font-medium">Forms</th>
                <th className="px-4 py-2.5 font-medium">Domains</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Loading sites…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Could not load sites.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && sites.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No sites yet. Create the first one.
                  </td>
                </tr>
              )}
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.primaryDomain ??
                        s.customDomain ??
                        (platformBase ? `${s.subdomain}.${platformBase}` : s.subdomain)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === PLATFORM_SITE_STATUS_SUSPENDED ? "destructive" : "success"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{s.counts.pages}</td>
                  <td className="px-4 py-3">{s.counts.publishedPages}</td>
                  <td className="px-4 py-3">{s.counts.members}</td>
                  <td className="px-4 py-3">{s.counts.forms}</td>
                  <td className="px-4 py-3">{s.counts.domains}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={s.status === PLATFORM_SITE_STATUS_SUSPENDED ? "Activate" : "Suspend"}
                        onClick={() => toggleStatus(s)}
                      >
                        {s.status === PLATFORM_SITE_STATUS_SUSPENDED ? (
                          <Play className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Pause className="h-4 w-4 text-amber-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Open in site admin"
                        onClick={() => openSite(s)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

const CreateSiteDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const create = usePlatformCreateSite();
  const platformBase = getPlatformBaseDomain();
  const [name, setName] = React.useState("");
  const [subdomain, setSubdomain] = React.useState("");
  const [touchedSub, setTouchedSub] = React.useState(false);

  React.useEffect(() => {
    if (!touchedSub) setSubdomain(slugify(name));
  }, [name, touchedSub]);
  React.useEffect(() => {
    if (!open) {
      setName("");
      setSubdomain("");
      setTouchedSub(false);
    }
  }, [open]);

  const subValid = SUBDOMAIN_RE.test(subdomain);
  const canSubmit = name.trim().length >= 2 && subValid && !create.isPending;

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      { name: name.trim(), subdomain },
      {
        onSuccess: () => {
          toast.success("Site created");
          onOpenChange(false);
        },
        onError: () => toast.error("Could not create site. The subdomain may be taken."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Create site
          </DialogTitle>
          <DialogDescription>
            Spin up a new tenant. You become its first admin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plat-site-name">Site name</Label>
            <Input
              id="plat-site-name"
              value={name}
              autoFocus
              placeholder="Acme Marketing"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plat-site-subdomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="plat-site-subdomain"
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create site
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
