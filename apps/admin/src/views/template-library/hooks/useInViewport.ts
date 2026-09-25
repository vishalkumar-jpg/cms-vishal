import * as React from "react";

const DEFAULT_ROOT_MARGIN = "120px";

/**
 * Fires once when the target enters the viewport (with margin).
 * Stays true after first intersection so rendered previews are not torn down on scroll.
 */
export const useInViewport = (
  ref: React.RefObject<Element | null>,
  options?: Pick<IntersectionObserverInit, "rootMargin" | "threshold">,
): boolean => {
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: options?.rootMargin ?? DEFAULT_ROOT_MARGIN,
        threshold: options?.threshold ?? 0.01,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options?.rootMargin, options?.threshold]);

  return inView;
};
