import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";

/** A read-only code field with a copy-to-clipboard button. */
export const CopyField: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label ?? "Value"} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
        {value}
      </code>
      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};
