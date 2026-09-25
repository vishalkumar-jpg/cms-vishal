"use client";

import * as React from "react";
import { armMobileCarousels } from "@ob-cms/blocks";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Builder canvas runtime for scroll/entrance animations — mirrors the published
 * site's ScrollFX so Motion presets preview correctly while editing.
 */
export const BuilderScrollFX: React.FC = () => {
  const breakpoint = useEditorUiStore((s) => s.breakpoint);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const roots = Array.from(document.querySelectorAll<HTMLElement>(".ob-site"));
    if (roots.length === 0) return;
    for (const root of roots) root.classList.add("js-ready");

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const revealEls = Array.from(
      document.querySelectorAll<HTMLElement>('[style*="--ob-reveal-effect"]'),
    );
    const parallaxEls = Array.from(
      document.querySelectorAll<HTMLElement>('[style*="--ob-parallax-speed"]'),
    );
    const animEls = Array.from(
      document.querySelectorAll<HTMLElement>('[style*="--ob-anim-preset"]'),
    ).filter((el) => {
      const t = el.style.getPropertyValue("--ob-anim-trigger").trim();
      return t === "scroll" || t === "click";
    });

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      for (const el of revealEls) el.classList.add("ob-revealed");
      for (const el of animEls) el.classList.add("ob-anim-run");
      const carouselCleanups = roots.map((root) => armMobileCarousels(root));
      return () => {
        for (const fn of carouselCleanups) fn();
        for (const root of roots) root.classList.remove("js-ready");
      };
    }

    const cleanups: Array<() => void> = [];

    if (revealEls.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            const once = el.style.getPropertyValue("--ob-reveal-once").trim() !== "0";
            if (entry.isIntersecting) {
              el.classList.add("ob-revealed");
              if (once) observer.unobserve(el);
            } else if (!once) {
              el.classList.remove("ob-revealed");
            }
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      );
      for (const el of revealEls) observer.observe(el);
      cleanups.push(() => observer.disconnect());
    }

    if (animEls.length > 0) {
      const scrollEls = animEls.filter(
        (el) => el.style.getPropertyValue("--ob-anim-trigger").trim() === "scroll",
      );
      const clickEls = animEls.filter(
        (el) => el.style.getPropertyValue("--ob-anim-trigger").trim() === "click",
      );

      if (scrollEls.length > 0) {
        const animObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const el = entry.target as HTMLElement;
              const once = el.style.getPropertyValue("--ob-anim-once").trim() !== "0";
              if (entry.isIntersecting) {
                el.classList.add("ob-anim-run");
                if (once) animObserver.unobserve(el);
              } else if (!once) {
                el.classList.remove("ob-anim-run");
              }
            }
          },
          { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
        );
        for (const el of scrollEls) animObserver.observe(el);
        cleanups.push(() => animObserver.disconnect());
      }

      for (const el of clickEls) {
        const onClick = (): void => {
          el.classList.remove("ob-anim-run");
          void el.offsetWidth;
          el.classList.add("ob-anim-run");
        };
        el.addEventListener("click", onClick);
        cleanups.push(() => el.removeEventListener("click", onClick));
      }
    }

    if (parallaxEls.length > 0) {
      let ticking = false;
      const apply = (): void => {
        ticking = false;
        const vh = window.innerHeight || 0;
        for (const el of parallaxEls) {
          const speed = parseFloat(el.style.getPropertyValue("--ob-parallax-speed")) || 0;
          if (!speed) continue;
          const rect = el.getBoundingClientRect();
          const offset = rect.top + rect.height / 2 - vh / 2;
          el.style.transform = `translate3d(0, ${(-offset * speed).toFixed(2)}px, 0)`;
        }
      };
      const onScroll = (): void => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(apply);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      apply();
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
    }

    for (const root of roots) {
      cleanups.push(armMobileCarousels(root));
    }

    return () => {
      for (const fn of cleanups) fn();
      for (const root of roots) root.classList.remove("js-ready");
    };
  }, [breakpoint]);

  return null;
};
