import * as React from "react";
import { Button, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useImportRedirects } from "../hooks/useRedirects";

const CSV_PLACEHOLDER = `fromPath,toPath,statusCode
/old,/new,301
/legacy,https://example.com,302`;

export const ImportRedirectsDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const importRedirects = useImportRedirects();
  const [csv, setCsv] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) setCsv("");
  }, [open]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!csv.trim()) {
      toast.error("Paste or upload CSV content first");
      return;
    }
    try {
      const result = await importRedirects.mutateAsync({ csv });
      const count = result?.imported;
      toast.success(
        typeof count === "number" ? `Imported ${count} redirects` : "Redirects imported",
      );
      onOpenChange(false);
    } catch {
      toast.error("Could not import redirects");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import redirects</DialogTitle>
          <DialogDescription>
            Paste CSV or upload a .csv file with header{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              fromPath,toPath,statusCode
            </code>
            .
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-csv">CSV</Label>
            <Textarea
              id="redirect-csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              placeholder={CSV_PLACEHOLDER}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-csv-file">Or upload a file</Label>
            <input
              ref={fileInputRef}
              id="redirect-csv-file"
              type="file"
              accept=".csv"
              onChange={onFileChange}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={importRedirects.isPending}>
              Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
