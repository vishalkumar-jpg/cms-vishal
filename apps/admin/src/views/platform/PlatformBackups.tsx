import * as React from "react";
import {
  Database,
  Plus,
  Loader2,
  Download,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/ui";
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
import {
  usePlatformBackups,
  usePlatformCreateBackup,
  usePlatformRestoreBackup,
  usePlatformDeleteBackup,
} from "./hooks/usePlatform";
import { platformBackupDownloadRequest, type PlatformBackup } from "./api/platform.api";

const STATUS_VARIANT: Record<
  PlatformBackup["status"],
  "success" | "warning" | "destructive" | "muted"
> = {
  completed: "success",
  running: "warning",
  pending: "muted",
  failed: "destructive",
};

const formatBytes = (n: number | null): string => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString() : "—";

/**
 * Platform database BACKUPS (gap E26). List of all pg_dump backups with a
 * "Create backup" button, per-row download / restore (scary confirm) / delete.
 * Cross-tenant super-admin only — lives in the platform console shell.
 */
export const PlatformBackups: React.FC = () => {
  const { data: backups = [], isLoading, isError } = usePlatformBackups();
  const create = usePlatformCreateBackup();
  const remove = usePlatformDeleteBackup();
  const confirm = useConfirm();
  const [restoreTarget, setRestoreTarget] = React.useState<PlatformBackup | null>(null);

  const onCreate = (): void => {
    create.mutate(undefined, {
      onSuccess: () => toast.success("Backup started — this may take a few minutes"),
      onError: () => toast.error("Could not start backup"),
    });
  };

  const onDownload = async (b: PlatformBackup): Promise<void> => {
    try {
      const { url } = await platformBackupDownloadRequest(b.id);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Could not get a download link");
    }
  };

  const onDelete = (b: PlatformBackup): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete backup ${b.filename}?`,
        description: "The dump file is removed permanently and cannot be recovered.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!ok) return;
      remove.mutate(b.id, {
        onSuccess: () => toast.success("Backup deleted"),
        onError: () => toast.error("Could not delete backup"),
      });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Database className="h-6 w-6 text-primary" /> Backups
          </h1>
          <p className="text-sm text-muted-foreground">
            Database backups ({backups.length}). A daily backup runs automatically; older backups
            are pruned by the retention policy.
          </p>
        </div>
        <Button onClick={onCreate} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          Create backup
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Filename</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading backups…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Could not load backups.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && backups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No backups yet. Create the first one.
                  </td>
                </tr>
              )}
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{b.filename}</div>
                    {b.status === "failed" && b.error && (
                      <div className="mt-0.5 max-w-md truncate text-xs text-destructive" title={b.error}>
                        {b.error}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.kind}</td>
                  <td className="px-4 py-3">{formatBytes(b.sizeBytes)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(b.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Download dump"
                        disabled={b.status !== "completed"}
                        onClick={() => void onDownload(b)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Restore this backup"
                        disabled={b.status !== "completed"}
                        onClick={() => setRestoreTarget(b)}
                      >
                        <RotateCcw className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Delete backup"
                        onClick={() => onDelete(b)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <RestoreDialog target={restoreTarget} onClose={() => setRestoreTarget(null)} />
    </div>
  );
};

/** Destructive restore confirmation. Requires typing RESTORE to enable. */
const RestoreDialog: React.FC<{
  target: PlatformBackup | null;
  onClose: () => void;
}> = ({ target, onClose }) => {
  const restore = usePlatformRestoreBackup();
  const [confirmText, setConfirmText] = React.useState("");

  React.useEffect(() => {
    if (!target) setConfirmText("");
  }, [target]);

  const canRestore = confirmText.trim().toUpperCase() === "RESTORE" && !restore.isPending;

  const submit = (): void => {
    if (!target || !canRestore) return;
    restore.mutate(target.id, {
      onSuccess: () => {
        toast.success("Restore started — the database is being overwritten");
        onClose();
      },
      onError: () => toast.error("Could not start restore"),
    });
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Restore database
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This will <strong>overwrite the entire live database</strong> with the contents of{" "}
              <span className="font-mono text-xs">{target?.filename}</span>. All data created since
              this backup will be <strong>permanently lost</strong>. There is no undo.
            </span>
            <span className="block">
              Type <span className="font-mono font-semibold">RESTORE</span> to confirm.
            </span>
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESTORE"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-destructive/40"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={!canRestore} onClick={submit}>
            {restore.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Overwrite database
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
