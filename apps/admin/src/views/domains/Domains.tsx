import * as React from "react";
import {
  Globe,
  Info,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useSiteStore } from "@/store/siteStore";
import { AddDomainDialog } from "./components/AddDomainDialog";
import { DnsInstructionsPanel } from "./components/DnsInstructionsPanel";
import {
  useDeleteDomain,
  useDomains,
  useSetPrimaryDomain,
  useSslCheckDomain,
  useVerifyDomain,
} from "./hooks/useDomains";
import type { Domain, DomainStatus, TlsStatus } from "./types";

const STATUS_VARIANT: Record<DomainStatus, "muted" | "warning" | "success" | "destructive"> = {
  pending: "muted",
  verifying: "warning",
  verified: "success",
  active: "success",
  failed: "destructive",
};

const TLS_VARIANT: Record<TlsStatus, "muted" | "warning" | "success" | "destructive"> = {
  none: "muted",
  pending: "warning",
  issued: "success",
  failed: "destructive",
};

/** SITE-HEALTH — a cert-status badge: "SSL valid · expires in N days" etc. */
const CertBadge: React.FC<{ domain: Domain }> = ({ domain }) => {
  const { certStatus, daysToExpiry, tlsCheckError } = domain;
  if (certStatus === "ok") {
    return (
      <Badge variant="success">
        <ShieldCheck className="mr-1 h-3 w-3" />
        SSL valid{daysToExpiry !== null ? ` · expires in ${daysToExpiry} days` : ""}
      </Badge>
    );
  }
  if (certStatus === "expiring-soon") {
    return (
      <Badge variant="warning">
        <ShieldAlert className="mr-1 h-3 w-3" />
        Expires in {daysToExpiry} days
      </Badge>
    );
  }
  if (certStatus === "expired") {
    return (
      <Badge variant="destructive">
        <ShieldX className="mr-1 h-3 w-3" />
        Expired
      </Badge>
    );
  }
  if (certStatus === "error") {
    return (
      <Badge variant="destructive" title={tlsCheckError ?? undefined}>
        <ShieldX className="mr-1 h-3 w-3" />
        Check failed{tlsCheckError ? ` (${tlsCheckError})` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="muted">
      <ShieldCheck className="mr-1 h-3 w-3" />
      Not checked
    </Badge>
  );
};

export const Domains: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [addOpen, setAddOpen] = React.useState(false);

  const { data: domains = [], isLoading, isError } = useDomains();

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Domains</h1>
          <p className="text-sm text-muted-foreground">
            Connect your own domain and serve this site on it over HTTPS.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!siteId}>
          <Plus className="mr-1.5 h-4 w-4" /> Add domain
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Domain</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">TLS</th>
              <th className="px-4 py-3 font-medium">SSL cert</th>
              <th className="px-4 py-3 font-medium">Primary</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow text="Select a site to manage its domains." />}
            {siteId && isLoading && <EmptyRow text="Loading domains…" />}
            {siteId && isError && <EmptyRow text="Could not load domains." />}
            {siteId && !isLoading && !isError && domains.length === 0 && (
              <EmptyRow text="No custom domains yet. Add your first domain." />
            )}
            {domains.map((domain) => (
              <DomainRow key={domain.id} domain={domain} />
            ))}
          </tbody>
        </table>
      </div>

      <AddDomainDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
};

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <tr>
    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
      <Globe className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {text}
    </td>
  </tr>
);

const DomainRow: React.FC<{ domain: Domain }> = ({ domain }) => {
  const [showDns, setShowDns] = React.useState(false);
  const confirm = useConfirm();
  const verify = useVerifyDomain();
  const setPrimary = useSetPrimaryDomain();
  const del = useDeleteDomain();
  const sslCheck = useSslCheckDomain();

  const onSslCheck = (): void => {
    sslCheck.mutate(domain.id, {
      onSuccess: () => toast.success(`Cert check queued for ${domain.domain}`),
      onError: () => toast.error("Could not queue cert check"),
    });
  };

  const onVerify = (): void => {
    verify.mutate(domain.id, {
      onSuccess: (res) => {
        if (res.verified) toast.success(`${domain.domain} verified`);
        else toast.error(res.reason ?? "Verification failed");
      },
      onError: () => toast.error("Verification failed"),
    });
  };

  const onSetPrimary = (): void => {
    void (async () => {
      const ok = await confirm({
        title: `Set "${domain.domain}" as primary domain?`,
        description: "This domain will become the canonical URL for your public site.",
        confirmLabel: "Set as primary",
      });
      if (!ok) return;
      setPrimary.mutate(domain.id, {
        onSuccess: () => toast.success(`${domain.domain} is now primary`),
        onError: () => toast.error("Could not set primary (verify it first)"),
      });
    })();
  };

  const onDelete = (): void => {
    void (async () => {
      const ok = await confirm({
        title: `Remove "${domain.domain}"?`,
        description: "This custom domain will be disconnected from your site.",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;
      del.mutate(domain.id, {
        onSuccess: () => toast.success("Domain removed"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  const instructions = {
    txtRecord: {
      name: `_ob-verify.${domain.domain}`,
      type: "TXT" as const,
      value: `ob-verify=${domain.verificationToken}`,
    },
    routing: { type: "CNAME" as const, name: domain.domain, value: "your platform host" },
  };

  return (
    <>
      <tr className="hover:bg-muted/30">
        <td className="px-4 py-3 font-medium">{domain.domain}</td>
        <td className="px-4 py-3">
          <Badge variant={STATUS_VARIANT[domain.status]}>{domain.status}</Badge>
        </td>
        <td className="px-4 py-3">
          <Badge variant={TLS_VARIANT[domain.tlsStatus]}>
            <ShieldCheck className="mr-1 h-3 w-3" />
            {domain.tlsStatus}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <CertBadge domain={domain} />
        </td>
        <td className="px-4 py-3">
          {domain.isPrimary ? (
            <Badge variant="default">
              <Star className="mr-1 h-3 w-3" /> Primary
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {!domain.verified && (
              <Button variant="outline" size="sm" onClick={onVerify} disabled={verify.isPending}>
                Verify
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowDns((v) => !v)}>
                  <Info className="h-4 w-4" /> DNS records
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSslCheck} disabled={sslCheck.isPending}>
                  <RefreshCw className="h-4 w-4" /> Re-check SSL cert
                </DropdownMenuItem>
                {domain.verified && !domain.isPrimary && (
                  <DropdownMenuItem onClick={onSetPrimary}>
                    <Star className="h-4 w-4" /> Set as primary
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
      {showDns && (
        <tr>
          <td colSpan={6} className="bg-muted/20 px-4 py-4">
            <DnsInstructionsPanel instructions={instructions} />
          </td>
        </tr>
      )}
    </>
  );
};
