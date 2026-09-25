import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Button } from "@/components/ui";

const STORAGE_KEY = "ob-builder-session-backup";

interface SessionBackup {
  pageId: string;
  json: string;
  savedAt: number;
}

export const writeSessionBackup = (pageId: string, json: string): void => {
  try {
    const payload: SessionBackup = { pageId, json, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota — ignore */
  }
};

export const readSessionBackup = (pageId: string): SessionBackup | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionBackup;
    if (parsed.pageId !== pageId) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearSessionBackup = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/** Periodic local backup + recovery dialog on mismatch. */
export const SessionRecoveryDialog: React.FC<{
  pageId: string | null;
  initialSerialized?: string | null;
}> = ({ pageId, initialSerialized = null }) => {
  const { query, actions } = useEditor();
  const [backup, setBackup] = React.useState<SessionBackup | null>(null);

  React.useEffect(() => {
    if (!pageId) return;
    const id = window.setInterval(() => {
      try {
        const json = query.serialize();
        writeSessionBackup(pageId, json);
      } catch {
        /* ignore */
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, [pageId, query]);

  React.useEffect(() => {
    if (!pageId) return;
    const b = readSessionBackup(pageId);
    if (!b) return;

    const compare = (): void => {
      try {
        const current = initialSerialized ?? query.serialize();
        if (current !== b.json && Date.now() - b.savedAt < 1000 * 60 * 60 * 24) {
          setBackup(b);
        }
      } catch {
        /* ignore */
      }
    };

    const idleId = requestIdleCallback(compare);
    return () => cancelIdleCallback(idleId);
  }, [pageId, query, initialSerialized]);

  if (!backup) return null;

  const restore = (): void => {
    try {
      actions.deserialize(backup.json);
      clearSessionBackup();
      setBackup(null);
    } catch {
      setBackup(null);
    }
  };

  const dismiss = (): void => {
    clearSessionBackup();
    setBackup(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg dark:bg-amber-950/40">
      <p className="text-sm font-semibold">Recover unsaved work?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        A local backup from {new Date(backup.savedAt).toLocaleString()} differs from the loaded page.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Dismiss
        </Button>
        <Button size="sm" onClick={restore}>
          Restore backup
        </Button>
      </div>
    </div>
  );
};
