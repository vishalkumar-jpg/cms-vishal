import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Slide-in navigation drawer for viewports below `md`. */
export const MobileNavDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ open, onClose, title, footer, children, className }) => {
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  const drawerRef = React.useRef<HTMLElement>(null);
  const prevFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      prevFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const el = drawerRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const ariaLabel = typeof title === "string" ? title : "Navigation menu";

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(88vw,17rem)] flex-col border-r border-border bg-card shadow-xl md:hidden",
          className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          {title}
          <Button
            ref={closeBtnRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer ? <div className="shrink-0 border-t border-border">{footer}</div> : null}
      </aside>
    </>
  );
};
