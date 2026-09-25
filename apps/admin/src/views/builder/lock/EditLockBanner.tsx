import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui";
import type { LockView } from "./lock.api";

/**
 * CONTENT-OPS — "🔒 X is editing" banner shown when another editor holds a live
 * lock. Offers View-only (stay, don't steal) vs Take over (steal the lock). Soft
 * advisory: saving is never hard-blocked; this only warns.
 */
export const EditLockBanner: React.FC<{
  holder: LockView["holder"];
  onTakeOver: () => void;
}> = ({ holder, onTakeOver }) => {
  const [dismissed, setDismissed] = React.useState(false);
  if (!holder || dismissed) return null;
  return (
    <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <Lock className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold">🔒 {holder.userName} is editing</strong> this content.
        You can view it, but your changes may be overwritten unless you take over.
      </span>
      <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
        View only
      </Button>
      <Button
        size="sm"
        onClick={() => {
          onTakeOver();
          setDismissed(true);
        }}
      >
        Take over
      </Button>
    </div>
  );
};
