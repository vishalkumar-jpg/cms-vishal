import * as React from "react";

/** Trap Tab focus inside an open modal/drawer panel. */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean): void {
  React.useEffect(() => {
    if (!active || !containerRef.current) return;
    const root = containerRef.current;
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusables = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(selector));

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") return;
      const nodes = focusables();
      if (nodes.length === 0) return;
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}

/** Lock body scroll and wire Escape for modal overlays. */
let scrollLockCount = 0;
let savedBodyOverflow = "";

function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockBodyScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
  }
}

export function useModalOverlay(
  open: boolean,
  onClose: () => void,
  options?: { lockScroll?: boolean },
): void {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    const lockScroll = options?.lockScroll !== false;
    if (lockScroll) lockBodyScroll();
    window.addEventListener("keydown", onKey);
    return () => {
      if (lockScroll) unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, options?.lockScroll]);
}
