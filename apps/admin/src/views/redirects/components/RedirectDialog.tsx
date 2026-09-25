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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { useCreateRedirect, useUpdateRedirect } from "../hooks/useRedirects";
import { REDIRECT_CODES, type Redirect } from "../types";

const DEFAULT_CODE = 301;

export const RedirectDialog: React.FC<{
  redirect: Redirect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ redirect, open, onOpenChange }) => {
  const isEdit = redirect !== null;
  const create = useCreateRedirect();
  const update = useUpdateRedirect();

  const [fromPath, setFromPath] = React.useState("");
  const [toPath, setToPath] = React.useState("");
  const [statusCode, setStatusCode] = React.useState<number>(DEFAULT_CODE);
  const [error, setError] = React.useState<string | null>(null);

  // Sync form state whenever the dialog opens or the target redirect changes.
  React.useEffect(() => {
    if (!open) return;
    setFromPath(redirect?.fromPath ?? "");
    setToPath(redirect?.toPath ?? "");
    setStatusCode(redirect?.statusCode ?? DEFAULT_CODE);
    setError(null);
  }, [open, redirect]);

  const isPending = create.isPending || update.isPending;

  const validate = (): string | null => {
    if (!fromPath.trim()) return "From path is required.";
    if (!fromPath.startsWith("/")) return 'From path must start with "/".';
    if (!toPath.trim()) return "To path is required.";
    const isPath = toPath.startsWith("/");
    const isUrl = /^https?:\/\//i.test(toPath);
    if (!isPath && !isUrl) return 'To path must start with "/" or be an http(s) URL.';
    return null;
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    try {
      if (isEdit && redirect) {
        await update.mutateAsync({
          id: redirect.id,
          payload: { fromPath, toPath, statusCode },
        });
        toast.success("Redirect updated");
      } else {
        await create.mutateAsync({ fromPath, toPath, statusCode });
        toast.success("Redirect created");
      }
      onOpenChange(false);
    } catch {
      toast.error(isEdit ? "Could not update redirect" : "Could not create redirect");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit redirect" : "New redirect"}</DialogTitle>
          <DialogDescription>
            Forward an old path to a new path or external URL.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-from">From path</Label>
            <Input
              id="redirect-from"
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              autoFocus
              placeholder="/old-path"
            />
            <span className="text-xs text-muted-foreground">must start with /</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-to">To path</Label>
            <Input
              id="redirect-to"
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder="/new-path or https://…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-code">Status code</Label>
            <Select
              value={String(statusCode)}
              onValueChange={(v) => setStatusCode(Number(v))}
            >
              <SelectTrigger id="redirect-code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REDIRECT_CODES.map((code) => (
                  <SelectItem key={code} value={String(code)}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <span className="text-xs text-destructive">{error}</span>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Save changes" : "Create redirect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
