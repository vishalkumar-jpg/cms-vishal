import * as React from "react";
import { AlertTriangle } from "lucide-react";
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
import { useCreateApiKey } from "../hooks/useDevelopers";
import { CopyField } from "./CopyField";

/**
 * Create an API key → show the plaintext ONCE. After creation the dialog flips
 * to a reveal panel; the key cannot be retrieved again once dismissed.
 */
export const ApiKeyDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const create = useCreateApiKey();
  const [name, setName] = React.useState("");
  const [plaintext, setPlaintext] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setPlaintext(null);
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await create.mutateAsync({ name: name.trim() });
      setPlaintext(created.plaintext);
      toast.success("API key created");
    } catch {
      toast.error("Could not create API key");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plaintext ? "Copy your API key" : "New API key"}</DialogTitle>
          <DialogDescription>
            {plaintext
              ? "This is the only time the key is shown. Store it securely."
              : "Create a read-only key for the public Content API."}
          </DialogDescription>
        </DialogHeader>

        {plaintext ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                You won&apos;t be able to see this key again. Copy it now and keep it secret.
              </span>
            </div>
            <CopyField value={plaintext} label="API key" />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="Production read key"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || !name.trim()}>
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
