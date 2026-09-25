"use client";

import * as React from "react";
import { armMobileCarousels } from "@ob-cms/blocks";

/**
 * ScrollFX — the tiny client runtime for scroll / entrance interactions
 * (TECH: see packages/blocks/SCROLL-INTERACTIONS.md). SSR-safe: it touches no
 * browser API at module load; everything runs inside a mount effect.
 *
 * On mount it:
 *  1. Adds `js-ready` to every `.ob-site` root. This is what ACTIVATES the
 *     hidden/offset initial state in `blocks.css` (`.ob-site.js-ready
 *     [style*="--ob-reveal-effect"]:not(.ob-revealed)`). Without the script
 *     (JS off/failed) `js-ready` is never added, so reveal content stays fully
 *     VISIBLE — no permanently-hidden content.
 *  2. Sets up ONE IntersectionObserver that adds `.ob-revealed` to
 *     `[style*="--ob-reveal-effect"]` elements as they enter the viewport.
 *     `once` is the default; an element opting out (`--ob-reveal-once: 0`) keeps
 *     being observed and toggles off when it leaves.
 *  3. Runs a single rAF-throttled scroll loop translating
 *     `[style*="--ob-parallax-speed"]` elements by `scroll * speed`.
 *  4. Arms one-click ANIMATION PRESETS whose trigger needs JS —
 *     `scroll` (IntersectionObserver → `.ob-anim-run`) and `click`
 *     (restart keyframe on click). `hover` + `load` triggers are pure CSS.
 *
 * It is a NO-OP when there are no reveal/parallax elements (no observer, no
 * scroll listener registered). Respects `prefers-reduced-motion`: it still adds
 * `js-ready` but immediately reveals everything and skips parallax (the CSS
 * reduced-motion guard also forces visibility, belt-and-suspenders).
 */
export const ScrollFX: React.FC = () => {
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
    // Preset animations whose trigger needs JS to arm them (scroll / click).
    // hover + load triggers are handled entirely by CSS (no-JS-safe).
    const animEls = Array.from(
      document.querySelectorAll<HTMLElement>('[style*="--ob-anim-preset"]'),
    ).filter((el) => {
      const t = el.style.getPropertyValue("--ob-anim-trigger").trim();
      return t === "scroll" || t === "click";
    });

    // Reduced motion OR no IntersectionObserver → just reveal everything.
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      for (const el of revealEls) el.classList.add("ob-revealed");
      for (const el of animEls) el.classList.add("ob-anim-run");
      const carouselCleanups = roots.map((root) => armMobileCarousels(root));
      return () => {
        for (const fn of carouselCleanups) fn();
      };
    }

    const cleanups: Array<() => void> = [];

    /* ── Reveal-on-scroll ─────────────────────────────────────────────── */
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

    /* ── Preset animations (scroll-into-view + click triggers) ────────── */
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
        // Restart the keyframe on each click (remove → reflow → re-add).
        const onClick = (): void => {
          el.classList.remove("ob-anim-run");
          void el.offsetWidth;
          el.classList.add("ob-anim-run");
        };
        el.addEventListener("click", onClick);
        cleanups.push(() => el.removeEventListener("click", onClick));
      }
    }

    /* ── Parallax (rAF-throttled scroll) ──────────────────────────────── */
    if (parallaxEls.length > 0) {
      let ticking = false;
      const apply = () => {
        ticking = false;
        const vh = window.innerHeight || 0;
        for (const el of parallaxEls) {
          const speed = parseFloat(el.style.getPropertyValue("--ob-parallax-speed")) || 0;
          if (!speed) continue;
          const rect = el.getBoundingClientRect();
          // Offset relative to viewport center → 0 at center, ± at edges.
          const offset = rect.top + rect.height / 2 - vh / 2;
          el.style.transform = `translate3d(0, ${(-offset * speed).toFixed(2)}px, 0)`;
        }
      };
      const onScroll = () => {
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

    /* ── Mobile auto-loop carousels (grids + sliders) ─────────────────── */
    for (const root of roots) {
      cleanups.push(armMobileCarousels(root));
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
};
