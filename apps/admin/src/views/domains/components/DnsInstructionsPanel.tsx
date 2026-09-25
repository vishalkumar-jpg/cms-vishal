import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import type { DnsInstructions } from "../types";

/** A single copyable name/value field. */
const CopyField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
          {value}
        </code>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
};

/**
 * The exact DNS records the tenant must publish: a TXT record to prove
 * ownership and a CNAME/A record to route traffic to the platform.
 */
export const DnsInstructionsPanel: React.FC<{ instructions: DnsInstructions }> = ({
  instructions,
}) => (
  <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">1. Prove ownership (TXT)</p>
      <CopyField label="Record name" value={instructions.txtRecord.name} />
      <CopyField label="Record value" value={instructions.txtRecord.value} />
    </div>
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        2. Route traffic ({instructions.routing.type})
      </p>
      <CopyField label="Record name" value={instructions.routing.name} />
      <CopyField label="Points to" value={instructions.routing.value} />
    </div>
    <p className="text-xs text-muted-foreground">
      Add these at your DNS provider, then click <strong>Verify</strong>. DNS changes can take a
      few minutes to propagate.
    </p>
  </div>
);
