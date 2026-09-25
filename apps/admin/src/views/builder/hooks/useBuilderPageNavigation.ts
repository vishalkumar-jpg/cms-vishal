import * as React from "react";
import { useNavigate } from "react-router";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { useSitePageLinks } from "./useSitePageLinks";
import { siteOriginUrl } from "../lib/siteUrl";

export type BuilderLinkMode = "editor" | "preview";

const isInternalHref = (href: string): boolean =>
  !!href && !href.startsWith("#") && !/^https?:\/\//i.test(href) && href.startsWith("/");

const isNavigableHref = (href: string): boolean =>
  !!href &&
  href !== "#" &&
  !href.startsWith("mailto:") &&
  !href.startsWith("tel:") &&
  !href.startsWith("javascript:");

const findCanvasAnchor = (target: EventTarget | null): HTMLAnchorElement | null =>
  (target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;

/**
 * Builder canvas/preview link clicks:
 * - Editor: single click blocks navigation (block selects); double click confirms + opens.
 * - Preview: single click confirms + opens.
 */
export const useBuilderPageNavigation = (
  mode: BuilderLinkMode = "editor",
): {
  onLinkClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
  onLinkDoubleClickCapture?: (e: React.MouseEvent<HTMLElement>) => void;
} => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { activeSite } = useActiveSite();
  const { resolvePageId } = useSitePageLinks();

  const openHref = React.useCallback(
    (href: string, target: string | null) => {
      if (isInternalHref(href)) {
        const pageId = resolvePageId(href);
        if (pageId) {
          navigate(`/pages/${pageId}/builder`);
          return;
        }
        const origin = siteOriginUrl(activeSite);
        if (origin) {
          window.open(`${origin}${href}`, "_blank", "noopener");
        }
        return;
      }

      if (target === "_blank") {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      window.location.assign(href);
    },
    [activeSite?.customDomain, activeSite?.subdomain, navigate, resolvePageId],
  );

  const confirmAndOpen = React.useCallback(
    async (anchor: HTMLAnchorElement, e: React.MouseEvent<HTMLElement>) => {
      const href = anchor.getAttribute("href")?.trim() ?? "";
      if (!isNavigableHref(href)) return;

      e.preventDefault();
      e.stopPropagation();
      window.getSelection()?.removeAllRanges();

      const ok = await confirm({
        title: mode === "preview" ? "Open link?" : "Leave the editor?",
        description:
          mode === "preview"
            ? "You are about to open this link. Do you want to continue?"
            : "You are about to open this link and leave the current page. Do you want to continue?",
        confirmLabel: "Open link",
      });
      if (!ok) return;
      openHref(href, anchor.target || null);
    },
    [confirm, mode, openHref],
  );

  const onLinkClickCapture = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const anchor = findCanvasAnchor(e.target);
      if (!anchor) return;

      const href = anchor.getAttribute("href")?.trim() ?? "";
      if (!isNavigableHref(href)) return;

      e.preventDefault();

      if (mode === "preview") {
        void confirmAndOpen(anchor, e);
      }
    },
    [confirmAndOpen, mode],
  );

  const onLinkDoubleClickCapture = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (mode !== "editor") return;

      const anchor = findCanvasAnchor(e.target);
      if (!anchor) return;

      const href = anchor.getAttribute("href")?.trim() ?? "";
      if (!isNavigableHref(href)) return;

      e.preventDefault();
      e.stopPropagation();
      window.getSelection()?.removeAllRanges();

      void confirmAndOpen(anchor, e);
    },
    [confirmAndOpen, mode],
  );

  return {
    onLinkClickCapture,
    onLinkDoubleClickCapture: mode === "editor" ? onLinkDoubleClickCapture : undefined,
  };
};
