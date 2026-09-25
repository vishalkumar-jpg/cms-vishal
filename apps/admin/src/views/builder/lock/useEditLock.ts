import * as React from "react";
import {
  acquireLockRequest,
  getLockRequest,
  releaseLockRequest,
  type LockEntity,
  type LockView,
} from "./lock.api";

const HEARTBEAT_MS = 30_000;

export interface EditLockState {
  /** True while we hold the lock (safe to edit without warning). */
  mine: boolean;
  /** Another editor holds a LIVE lock — show the banner + go view-only. */
  blockedBy: LockView["holder"] | null;
  /** Steal the lock from the current holder (explicit take-over). */
  takeOver: () => void;
  /** Whether the initial lock check has resolved (avoid a banner flash). */
  ready: boolean;
}

/**
 * CONTENT-OPS — advisory concurrent-edit lock lifecycle for a builder.
 *
 * On mount: acquire the lock. Every 30s: heartbeat (re-acquire, which refreshes
 * our heartbeat if we hold it). On unmount: release. If another editor holds a
 * live lock we do NOT get it — `blockedBy` is set so the shell shows a
 * "🔒 X is editing" banner with View-only vs Take over. Soft: this never blocks
 * a save; it only warns.
 *
 * A disabled hook (no id/siteId) is inert and reports `mine: true` so builders
 * without an id (shouldn't happen) are never falsely locked.
 */
export function useEditLock(
  entity: LockEntity,
  id: string | null,
  enabled: boolean,
): EditLockState {
  const [mine, setMine] = React.useState(false);
  const [blockedBy, setBlockedBy] = React.useState<LockView["holder"] | null>(null);
  const [ready, setReady] = React.useState(false);
  // Latest takeOver intent, read by the interval without re-subscribing.
  const takeOverRef = React.useRef(false);

  const apply = React.useCallback((view: LockView) => {
    setMine(view.mine);
    setBlockedBy(view.mine ? null : view.holder);
  }, []);

  React.useEffect(() => {
    if (!enabled || !id) {
      setMine(true);
      setBlockedBy(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    takeOverRef.current = false;

    const beat = async (): Promise<void> => {
      try {
        const view = await acquireLockRequest(entity, id, takeOverRef.current);
        takeOverRef.current = false;
        if (!cancelled) apply(view);
      } catch {
        // Network hiccup — fall back to a read so we still surface a live holder.
        try {
          const view = await getLockRequest(entity, id);
          if (!cancelled) apply(view);
        } catch {
          /* ignore; keep prior state */
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    const idleId = requestIdleCallback(() => void beat());
    const timer = window.setInterval(() => void beat(), HEARTBEAT_MS);

    return () => {
      cancelled = true;
      cancelIdleCallback(idleId);
      window.clearInterval(timer);
      // Best-effort release so the next editor isn't stuck until staleness.
      void releaseLockRequest(entity, id).catch(() => undefined);
    };
  }, [entity, id, enabled, apply]);

  const takeOver = React.useCallback(() => {
    if (!enabled || !id) return;
    takeOverRef.current = true;
    void acquireLockRequest(entity, id, true)
      .then(apply)
      .catch(() => undefined);
  }, [entity, id, enabled, apply]);

  return { mine, blockedBy, takeOver, ready };
}
