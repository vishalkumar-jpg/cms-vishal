import * as React from "react";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useCreateDomain } from "../hooks/useDomains";
import type { DnsInstructions } from "../types";
import { DnsInstructionsPanel } from "./DnsInstructionsPanel";

const HOSTNAME = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/;

export const AddDomainDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const create = useCreateDomain();
  const [domain, setDomain] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [instructions, setInstructions] = React.useState<DnsInstructions | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDomain("");
    setError(null);
    setInstructions(null);
  }, [open]);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const value = domain.trim().toLowerCase();
    if (!HOSTNAME.test(value)) {
      setError("Enter a bare hostname like www.acme.com (no http://, port, or path).");
      return;
    }
    setError(null);
    try {
      const result = await create.mutateAsync({ domain: value });
      setInstructions(result.instructions);
      toast.success("Domain added — publish the DNS records below");
    } catch {
      toast.error("Could not add domain (it may already be registered).");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{instructions ? "Set up DNS" : "Add a custom domain"}</DialogTitle>
          <DialogDescription>
            {instructions
              ? "Publish these records at your DNS provider, then verify the domain."
              : "Bind your own domain (e.g. www.acme.com) to this site."}
          </DialogDescription>
        </DialogHeader>

        {instructions ? (
          <div className="flex flex-col gap-4">
            <DnsInstructionsPanel instructions={instructions} />
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="domain-input">Domain</Label>
              <Input
                id="domain-input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                autoFocus
                placeholder="www.acme.com"
              />
              <span className="text-xs text-muted-foreground">bare hostname, no http:// or path</span>
            </div>
            {error && <span className="text-xs text-destructive">{error}</span>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                Add domain
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
