/**
 * Mobile carousel runtime — arms horizontal scroll tracks with auto-loop,
 * dot indicators, and pause-on-interaction. Used by ScrollFX / BuilderScrollFX.
 * No browser APIs at module load.
 */

export const MOBILE_CAROUSEL_MAX_WIDTH = 1024;
export const DEFAULT_CAROUSEL_INTERVAL_MS = 5000;

const CAROUSEL_SELECTORS = [
  '.cms-auto-grid[data-mobile-carousel="true"][data-auto-loop="true"]:not(.ob-partners-logo-grid)',
  '.ob-slider[data-auto-loop="true"]',
].join(",");

const PARTNERS_LOGO_SELECTOR =
  '.cms-auto-grid.ob-partners-logo-grid[data-mobile-carousel="true"]';

const PARTNERS_LOGO_FALLBACK_SELECTOR =
  '.cms-auto-grid[data-mobile-carousel="true"][data-columns="5"]';

const PARTNERS_HEADING = /meet our strategic partnerships/i;

function partnersMaxIndex(track: HTMLElement): number {
  return Math.max(0, slideCount(track) - 2);
}

function getTrack(wrapper: HTMLElement): HTMLElement {
  const track = wrapper.querySelector<HTMLElement>(":scope > .ob-slider__track");
  return track ?? wrapper;
}

function slideCount(track: HTMLElement): number {
  return track.children.length;
}

function readIntervalMs(wrapper: HTMLElement): number {
  const raw = wrapper.dataset.autoplayInterval;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CAROUSEL_INTERVAL_MS;
}

function carouselId(wrapper: HTMLElement): string {
  if (!wrapper.dataset.obCarouselId) {
    wrapper.dataset.obCarouselId = wrapper.id || `ob-carousel-${Math.random().toString(36).slice(2, 9)}`;
  }
  return wrapper.dataset.obCarouselId;
}

function findDots(wrapper: HTMLElement): HTMLElement | null {
  const id = wrapper.dataset.obCarouselId;
  if (!id) return null;
  const next = wrapper.nextElementSibling;
  if (
    next instanceof HTMLElement &&
    next.classList.contains("ob-carousel-dots") &&
    next.dataset.for === id
  ) {
    return next;
  }
  return null;
}

function currentIndex(track: HTMLElement): number {
  const children = Array.from(track.children) as HTMLElement[];
  if (children.length === 0) return 0;
  const scrollLeft = track.scrollLeft;
  let idx = 0;
  let best = Infinity;
  children.forEach((child, i) => {
    const dist = Math.abs(child.offsetLeft - scrollLeft);
    if (dist < best) {
      best = dist;
      idx = i;
    }
  });
  return idx;
}

/** Scroll only the horizontal track — never the page (scrollIntoView jumps the editor). */
function scrollToIndex(track: HTMLElement, index: number, behavior: ScrollBehavior = "smooth"): void {
  const child = track.children.item(index) as HTMLElement | null;
  if (!child) return;
  track.scrollTo({ left: child.offsetLeft, behavior });
}

function isNarrowForRoot(root: HTMLElement): boolean {
  const vp = root.getAttribute("data-ob-viewport");
  const bp = root.getAttribute("data-ob-breakpoint");
  if (vp === "mobile" || vp === "tablet" || bp === "mobile" || bp === "tablet") return true;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(`(max-width: ${MOBILE_CAROUSEL_MAX_WIDTH}px)`).matches;
  }
  return false;
}

function isPartnersLogoGridByContext(grid: HTMLElement): boolean {
  if (grid.classList.contains("ob-partners-logo-grid")) return true;
  if (grid.dataset.columns !== "5") return false;
  if (
    grid.classList.contains("ob-stats-grid") ||
    grid.classList.contains("ob-steps-grid") ||
    grid.classList.contains("ob-no-mobile-carousel")
  ) {
    return false;
  }
  const section = grid.closest(".cms-section");
  if (!section) return false;
  for (const heading of section.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    if (PARTNERS_HEADING.test(heading.textContent?.trim() ?? "")) return true;
  }
  return false;
}

function preparePartnersLogoGrid(grid: HTMLElement): void {
  grid.classList.add("ob-partners-logo-grid", "ob-no-auto-loop");
  grid.removeAttribute("data-auto-loop");
}

function collectPartnersLogoGrids(root: HTMLElement): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>(PARTNERS_LOGO_SELECTOR)) {
    found.add(el);
  }
  for (const el of root.querySelectorAll<HTMLElement>(PARTNERS_LOGO_FALLBACK_SELECTOR)) {
    if (isPartnersLogoGridByContext(el)) found.add(el);
  }
  return Array.from(found);
}

function isBuilderCanvas(root: HTMLElement): boolean {
  return root.dataset.obBuilderCanvas === "true";
}

function ensureDots(wrapper: HTMLElement, track: HTMLElement, count: number): HTMLElement {
  const id = carouselId(wrapper);
  let dots = findDots(wrapper);
  if (!dots) {
    dots = document.createElement("div");
    dots.className = "ob-carousel-dots";
    dots.dataset.for = id;
    dots.setAttribute("role", "tablist");
    dots.setAttribute("aria-label", "Carousel slides");
    wrapper.insertAdjacentElement("afterend", dots);
  }
  dots.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ob-carousel-dot";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-label", `Go to slide ${i + 1}`);
    btn.addEventListener("click", () => scrollToIndex(track, i));
    dots.appendChild(btn);
  }
  return dots;
}

function updateDots(dots: HTMLElement, index: number): void {
  dots.querySelectorAll<HTMLButtonElement>(".ob-carousel-dot").forEach((dot, i) => {
    const active = i === index;
    dot.classList.toggle("is-active", active);
    dot.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function armCarousel(root: HTMLElement, wrapper: HTMLElement): (() => void) | undefined {
  if (wrapper.dataset.obCarouselArmed === "1") return undefined;
  const track = getTrack(wrapper);
  const count = slideCount(track);
  if (count < 2) return undefined;

  wrapper.dataset.obCarouselArmed = "1";
  wrapper.classList.add("ob-carousel--armed");

  const inBuilder = isBuilderCanvas(root);
  let timer: ReturnType<typeof setInterval> | undefined;
  let paused = false;
  let dots: HTMLElement | undefined;

  const syncDots = (): void => {
    if (!dots) return;
    updateDots(dots, currentIndex(track));
  };

  const stop = (): void => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };

  const tick = (): void => {
    if (paused || !isNarrowForRoot(root) || inBuilder) return;
    const idx = currentIndex(track);
    if (idx >= count - 1) {
      scrollToIndex(track, 0);
    } else {
      scrollToIndex(track, idx + 1);
    }
  };

  const start = (): void => {
    stop();
    if (!isNarrowForRoot(root)) {
      dots?.remove();
      dots = undefined;
      return;
    }
    if (!inBuilder) {
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) {
        dots = ensureDots(wrapper, track, count);
        syncDots();
        timer = setInterval(tick, readIntervalMs(wrapper));
      }
    }
  };

  const onScroll = (): void => syncDots();
  const pause = (): void => {
    paused = true;
    stop();
  };
  const resume = (): void => {
    paused = false;
    start();
  };

  track.addEventListener("scroll", onScroll, { passive: true });
  if (!inBuilder) {
    track.addEventListener("pointerdown", pause);
    track.addEventListener("touchstart", pause, { passive: true });
    track.addEventListener("pointerup", resume);
    track.addEventListener("touchend", resume);
    wrapper.addEventListener("mouseenter", pause);
    wrapper.addEventListener("mouseleave", resume);
  }

  const mq = window.matchMedia(`(max-width: ${MOBILE_CAROUSEL_MAX_WIDTH}px)`);
  const onMq = (): void => (isNarrowForRoot(root) ? start() : stop());
  mq.addEventListener("change", onMq);

  const vpObserver = new MutationObserver(() => {
    if (isNarrowForRoot(root)) start();
    else stop();
  });
  vpObserver.observe(root, { attributes: true, attributeFilter: ["data-ob-viewport", "data-ob-breakpoint"] });

  start();

  return () => {
    stop();
    track.removeEventListener("scroll", onScroll);
    if (!inBuilder) {
      track.removeEventListener("pointerdown", pause);
      track.removeEventListener("touchstart", pause);
      track.removeEventListener("pointerup", resume);
      track.removeEventListener("touchend", resume);
      wrapper.removeEventListener("mouseenter", pause);
      wrapper.removeEventListener("mouseleave", resume);
    }
    mq.removeEventListener("change", onMq);
    vpObserver.disconnect();
    delete wrapper.dataset.obCarouselArmed;
    wrapper.classList.remove("ob-carousel--armed");
    dots?.remove();
  };
}

function armPartnersLogoSlider(root: HTMLElement, grid: HTMLElement): (() => void) | undefined {
  if (grid.dataset.obPartnersArmed === "1") return undefined;
  const count = slideCount(grid);
  if (count < 2) return undefined;

  let shell = grid.parentElement;
  if (!shell?.classList.contains("ob-partners-logo-slider")) {
    shell = document.createElement("div");
    shell.className = "ob-partners-logo-slider";
    grid.parentNode?.insertBefore(shell, grid);
    shell.appendChild(grid);
  }

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "ob-partners-logo-slider__btn ob-partners-logo-slider__btn--prev ob-carousel-btn";
  prev.setAttribute("aria-label", "Previous partners");
  prev.textContent = "‹";

  const next = document.createElement("button");
  next.type = "button";
  next.className = "ob-partners-logo-slider__btn ob-partners-logo-slider__btn--next ob-carousel-btn";
  next.setAttribute("aria-label", "Next partners");
  next.textContent = "›";

  shell.insertBefore(prev, grid);
  shell.appendChild(next);

  grid.dataset.obPartnersArmed = "1";

  const syncButtons = (): void => {
    const narrow = isNarrowForRoot(root);
    const show = narrow && count > 2;
    prev.hidden = !show;
    next.hidden = !show;
    if (!narrow) return;
    const idx = currentIndex(grid);
    prev.disabled = idx <= 0;
    next.disabled = idx >= partnersMaxIndex(grid);
  };

  const step = (dir: number): void => {
    const idx = currentIndex(grid);
    const nextIdx = Math.min(partnersMaxIndex(grid), Math.max(0, idx + dir));
    scrollToIndex(grid, nextIdx);
    syncButtons();
  };

  const onScroll = (): void => syncButtons();
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  grid.addEventListener("scroll", onScroll, { passive: true });

  const mq = window.matchMedia(`(max-width: ${MOBILE_CAROUSEL_MAX_WIDTH}px)`);
  const onMq = (): void => syncButtons();
  mq.addEventListener("change", onMq);

  const vpObserver = new MutationObserver(() => syncButtons());
  vpObserver.observe(root, { attributes: true, attributeFilter: ["data-ob-viewport", "data-ob-breakpoint"] });

  syncButtons();

  return () => {
    grid.removeEventListener("scroll", onScroll);
    prev.remove();
    next.remove();
    mq.removeEventListener("change", onMq);
    vpObserver.disconnect();
    delete grid.dataset.obPartnersArmed;
    if (shell?.classList.contains("ob-partners-logo-slider") && shell.contains(grid)) {
      shell.parentNode?.insertBefore(grid, shell);
      shell.remove();
    }
  };
}

/** Scan a `.ob-site` root and arm all mobile carousels. Returns a disconnect fn. */
export function armMobileCarousels(root: HTMLElement): () => void {
  const disposers = new Map<HTMLElement, () => void>();

  const scan = (): void => {
    for (const el of collectPartnersLogoGrids(root)) {
      preparePartnersLogoGrid(el);
      if (disposers.has(el)) continue;
      const dispose = armPartnersLogoSlider(root, el);
      if (dispose) disposers.set(el, dispose);
    }
    for (const el of root.querySelectorAll<HTMLElement>(CAROUSEL_SELECTORS)) {
      if (disposers.has(el) || el.classList.contains("ob-partners-logo-grid")) continue;
      const dispose = armCarousel(root, el);
      if (dispose) disposers.set(el, dispose);
    }
  };
  scan();

  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  const observer =
    typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
          if (scanTimer) clearTimeout(scanTimer);
          scanTimer = setTimeout(scan, 120);
        })
      : undefined;
  observer?.observe(root, { childList: true, subtree: true });

  return () => {
    if (scanTimer) clearTimeout(scanTimer);
    observer?.disconnect();
    for (const dispose of disposers.values()) dispose();
    disposers.clear();
  };
}
