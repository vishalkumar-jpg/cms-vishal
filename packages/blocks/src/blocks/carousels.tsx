"use client";

import * as React from "react";
import {
  applyPartStyles,
  cssFromMini,
  mergeVisualStyles,
  SafeLink,
  sanitizeText,
  useMounted,
  resolveSurfaceStyles,
} from "../lib";

/**
 * Carousels — SSR-safe. On the server (and first client paint) they render a
 * static, non-interactive track at index 0. After mount (`useMounted`), arrows
 * and autoplay are enabled. No `window`/`document`/timers at module load.
 */

const splitCarouselStyles = (styles: unknown) =>
  resolveSurfaceStyles(styles, { cursor: "pointer", font: "inherit", fontWeight: 600 });

/* ---- Logo Carousel ---------------------------------------------- */
const LOGO_CAROUSEL_TRACK_GAP = 12;

interface Logo {
  url?: string;
  alt?: string;
}
export const LogoCarousel = React.forwardRef<HTMLDivElement, {
  logos?: Array<Logo | string>;
  carousel?: boolean;
  marquee?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  showArrows?: boolean;
  slidesVisible?: number;
  partStyles?: Record<string, unknown>;
  styles?: unknown;
}>(({ logos = [], carousel = false, marquee = false, autoplay = false, autoplayInterval = 4000, showArrows = false, slidesVisible = 5, partStyles = {}, styles }, ref) => {
  const list = logos.length ? logos : [{ url: "", alt: "Partner" }];
  const mounted = useMounted();
  const [index, setIndex] = React.useState(0);
  const maxIndex = Math.max(0, list.length - slidesVisible);
  const { wrapper, surface: arrowSurface } = splitCarouselStyles(styles);
  const trackGridStyle = mergeVisualStyles(
    {
      display: "flex",
      flexWrap: "wrap",
      gap: LOGO_CAROUSEL_TRACK_GAP,
      alignItems: "center",
      justifyContent: "center",
    },
    partStyles.grid ? applyPartStyles(partStyles.grid) : {},
  );

  React.useEffect(() => {
    if (!mounted || !carousel || !autoplay || list.length <= slidesVisible) return undefined;
    const id = setInterval(() => setIndex((i) => (i >= maxIndex ? 0 : i + 1)), autoplayInterval);
    return () => clearInterval(id);
  }, [mounted, carousel, autoplay, autoplayInterval, list.length, slidesVisible, maxIndex]);

  const go = (dir: number) => setIndex((i) => Math.min(maxIndex, Math.max(0, i + dir)));

  const renderLogo = (logo: Logo | string, i: number, slide: boolean) => {
    const url = typeof logo === "string" ? logo : logo.url;
    const alt = typeof logo === "string" ? "" : logo.alt || "";
    const inner = url && url.startsWith("http") ? (
      <img src={url} alt={sanitizeText(alt)} loading="lazy" />
    ) : (
      <span style={{ fontWeight: 600, color: "#64748b", fontSize: 15 }}>{sanitizeText(url || String(logo))}</span>
    );
    return slide ? (
      <div key={i} className="ob-logo-carousel__slide" style={{ flex: `0 0 ${100 / slidesVisible}%` }}>
        {inner}
      </div>
    ) : (
      <React.Fragment key={i}>{inner}</React.Fragment>
    );
  };

  if (marquee) {
    // Continuous marquee — duplicate the list so the -50% keyframe loops seamlessly.
    const doubled = [...list, ...list];
    return (
      <div ref={ref} className="ob-logo-carousel ob-logo-carousel--marquee" style={wrapper}>
        <div className="ob-logo-carousel__track" style={trackGridStyle}>
          {doubled.map((logo, i) => renderLogo(logo, i, false))}
        </div>
      </div>
    );
  }

  if (carousel) {
    return (
      <div ref={ref} className="ob-logo-carousel ob-logo-carousel--slider" style={wrapper}>
        <div className="ob-logo-carousel__viewport">
          <div
            className="ob-logo-carousel__track"
            style={{ ...trackGridStyle, transform: `translateX(-${index * (100 / slidesVisible)}%)`, flexWrap: "nowrap" }}
          >
            {list.map((logo, i) => renderLogo(logo, i, true))}
          </div>
        </div>
        {mounted && showArrows && list.length > slidesVisible ? (
          <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end" }}>
            <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(-1)} aria-label="Previous">‹</button>
            <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(1)} aria-label="Next">›</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={ref} className="ob-logo-carousel" style={wrapper}>
      <div className="ob-logo-carousel__track" style={trackGridStyle}>
        {list.map((logo, i) => renderLogo(logo, i, false))}
      </div>
    </div>
  );
});
LogoCarousel.displayName = "Logo Carousel";

/* ---- Content Carousel ------------------------------------------- */
interface Slide {
  type?: string;
  imageUrl?: string;
  title?: string;
  content?: string;
  label?: string;
  linkText?: string;
  linkUrl?: string;
}
export const ContentCarousel = React.forwardRef<HTMLDivElement, {
  slides?: Slide[];
  slidesVisible?: number;
  showArrows?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  styles?: unknown;
}>(({ slides = [], slidesVisible = 3, showArrows = true, autoplay = false, autoplayInterval = 5000, styles }, ref) => {
  const list = slides.length ? slides : [{ type: "image", imageUrl: "", title: "Slide 1" }];
  const mounted = useMounted();
  const [index, setIndex] = React.useState(0);
  const maxIndex = Math.max(0, list.length - slidesVisible);
  const go = (dir: number) => setIndex((i) => Math.min(maxIndex, Math.max(0, i + dir)));
  const { wrapper, surface: arrowSurface } = splitCarouselStyles(styles);

  React.useEffect(() => {
    if (!mounted || !autoplay || list.length <= slidesVisible) return undefined;
    const id = setInterval(() => setIndex((i) => (i >= maxIndex ? 0 : i + 1)), autoplayInterval);
    return () => clearInterval(id);
  }, [mounted, autoplay, autoplayInterval, list.length, slidesVisible, maxIndex]);

  return (
    <div ref={ref} className="ob-content-carousel ob-carousel--touch" style={wrapper}>
      <div className="ob-content-carousel__viewport">
        <div className="ob-content-carousel__track ob-carousel-track--js" style={{ transform: `translateX(-${index * (100 / slidesVisible)}%)` }}>
          {list.map((slide, i) => (
            <div key={i} className="ob-content-carousel__slide" style={{ flex: `0 0 ${100 / slidesVisible}%` }}>
              {slide.type === "text" ? (
                <div className="ob-quote-card">
                  {slide.label ? (
                    <span style={{ fontSize: 12, color: "#147eff", marginBottom: 8, display: "block" }}>{sanitizeText(slide.label)}</span>
                  ) : null}
                  <p style={{ flex: 1, fontSize: 14, lineHeight: 1.6, color: "#6c7c93", display: "block" }}>{sanitizeText(slide.content)}</p>
                  {slide.linkText ? (
                    <SafeLink url={slide.linkUrl || "#"} style={{ color: "#147eff", fontWeight: 600, fontSize: 14, marginTop: 12, textDecoration: "none" }}>
                      {sanitizeText(slide.linkText)}
                    </SafeLink>
                  ) : null}
                </div>
              ) : (
                <div className="ob-article-card">
                  {slide.imageUrl ? <img src={String(slide.imageUrl)} alt={sanitizeText(slide.title)} loading="lazy" /> : null}
                  {slide.title ? <div className="ob-article-card__title">{sanitizeText(slide.title)}</div> : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {mounted && showArrows && list.length > slidesVisible ? (
        <div className="ob-carousel-nav" style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(-1)} aria-label="Previous">‹</button>
          <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(1)} aria-label="Next">›</button>
        </div>
      ) : null}
    </div>
  );
});
ContentCarousel.displayName = "Content Carousel";

/* ---- Video Testimonial Carousel --------------------------------- */
interface VtItem {
  type?: string;
  imageUrl?: string;
  name?: string;
  position?: string;
  videoUrl?: string;
  quote?: string;
  author?: string;
  role?: string;
}
export const VideoTestimonialCarousel = React.forwardRef<HTMLDivElement, {
  items?: VtItem[];
  slidesVisible?: number;
  showArrows?: boolean;
  useModal?: boolean;
  showReadMore?: boolean;
  quoteMaxLength?: number;
  showProgress?: boolean;
  styles?: unknown;
}>(({ items = [], slidesVisible = 3, showArrows = true, showReadMore = true, quoteMaxLength = 140, showProgress = true, styles }, ref) => {
  const list = items.length
    ? items
    : [
        { type: "video", imageUrl: "", name: "Client Name", position: "CEO", videoUrl: "#" },
        { type: "quote", quote: "Great experience.", author: "Jane Doe", role: "Director", imageUrl: "" },
      ];
  const mounted = useMounted();
  const [index, setIndex] = React.useState(0);
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const maxIndex = Math.max(0, list.length - slidesVisible);
  const go = (dir: number) => setIndex((i) => Math.min(maxIndex, Math.max(0, i + dir)));
  const { wrapper, surface: arrowSurface } = splitCarouselStyles(styles);
  const progress = maxIndex > 0 ? ((index + 1) / (maxIndex + 1)) * 100 : 100;

  return (
    <div ref={ref} className="ob-content-carousel ob-video-testimonial-carousel ob-carousel--touch" style={wrapper}>
      <div className="ob-content-carousel__viewport">
        <div className="ob-content-carousel__track ob-carousel-track--js" style={{ transform: `translateX(-${index * (100 / slidesVisible)}%)` }}>
          {list.map((item, i) => (
            <div key={i} className="ob-content-carousel__slide ob-video-testimonial-carousel__slide" style={{ flex: `0 0 ${100 / slidesVisible}%` }}>
              {item.type === "video" ? (
                <SafeLink url={item.videoUrl || "#"} className="ob-video-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  {item.imageUrl ? <img src={String(item.imageUrl)} alt={sanitizeText(item.name)} loading="lazy" /> : null}
                  <div className="ob-video-card__play">
                    <span className="ob-video-card__play-icon" aria-hidden>▶</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", display: "block" }}>{sanitizeText(item.name)}</div>
                      <div style={{ fontSize: 12, opacity: 0.9, color: "#fff", display: "block" }}>{sanitizeText(item.position)}</div>
                    </div>
                  </div>
                </SafeLink>
              ) : (
                <div className="ob-quote-card">
                  <div className="ob-quote-card__mark" aria-hidden>&ldquo;</div>
                  <p style={{ flex: 1, fontSize: 15, lineHeight: 1.6, color: "#6c7c93", margin: "0 0 16px", display: "block" }}>
                    {sanitizeText(
                      expanded === i || !showReadMore || !item.quote || item.quote.length <= quoteMaxLength
                        ? item.quote
                        : `${item.quote.slice(0, quoteMaxLength)}…`,
                    )}
                  </p>
                  {mounted && showReadMore && item.quote && item.quote.length > quoteMaxLength ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      style={{ background: "none", border: "none", color: "#147eff", fontWeight: 600, fontSize: 14, padding: 0, marginBottom: 12, cursor: "pointer" }}
                    >
                      {expanded === i ? "Show less" : "Read More"}
                    </button>
                  ) : null}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto" }}>
                    {item.imageUrl ? <img src={String(item.imageUrl)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} /> : null}
                    <div>
                      <div style={{ fontWeight: 700, color: "#147eff", fontSize: 14, display: "block" }}>{sanitizeText(item.author)}</div>
                      <div style={{ fontSize: 13, color: "#6c7c93", display: "block" }}>{sanitizeText(item.role)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {mounted && showArrows && list.length > slidesVisible ? (
        <div className="ob-carousel-nav ob-video-testimonial-carousel__nav" style={{ display: "flex", gap: 12, marginTop: 32, borderTop: "1px solid rgba(0,34,68,0.1)", paddingTop: 24, alignItems: "center" }}>
          <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(-1)} aria-label="Previous">‹</button>
          {showProgress ? (
            <div style={{ flex: 1, height: 4, background: "rgba(0,34,68,0.1)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "#147eff", transition: "width 0.3s" }} />
            </div>
          ) : null}
          <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(1)} aria-label="Next">›</button>
        </div>
      ) : null}
    </div>
  );
});
VideoTestimonialCarousel.displayName = "Video Testimonial Carousel";

/* ---- Article Card Grid ------------------------------------------ */
interface Article {
  imageUrl?: string;
  title?: string;
  url?: string;
  summary?: string;
  excerpt?: string;
  tags?: string[];
  readMoreText?: string;
  cardStyles?: Record<string, unknown>;
}
export const ArticleCardGrid = React.forwardRef<HTMLElement, {
  articles?: Article[];
  columns?: number;
  layout?: string;
  showArrows?: boolean;
  styles?: unknown;
}>(({ articles = [], columns = 4, layout = "grid", showArrows = true, styles }, ref) => {
  const list = articles.length ? articles : [{ imageUrl: "", title: "Article title", url: "#" }];
  const mounted = useMounted();
  const [index, setIndex] = React.useState(0);
  const isCarousel = layout === "carousel";
  const maxIndex = Math.max(0, list.length - columns);
  const go = (dir: number) => setIndex((i) => Math.min(maxIndex, Math.max(0, i + dir)));
  const { wrapper, surface: arrowSurface } = splitCarouselStyles(styles);

  const renderCard = (a: Article, i: number) => (
    <article key={i} className="ob-article-card ob-article-card--blog" style={cssFromMini(a.cardStyles)}>
      {a.tags && a.tags.length ? (
        <div className="ob-article-card__tags">
          {a.tags.map((tag, ti) => (
            <span key={ti} className="ob-article-card__tag">{sanitizeText(tag)}</span>
          ))}
        </div>
      ) : null}
      <h3 className="ob-article-card__title">
        <SafeLink url={a.url || "#"} style={{ color: "inherit", textDecoration: "none" }}>{sanitizeText(a.title)}</SafeLink>
      </h3>
      {a.summary || a.excerpt ? (
        <p className="ob-article-card__summary">{sanitizeText(a.summary || a.excerpt)}</p>
      ) : null}
      <div className="ob-article-card__read-more">
        <SafeLink url={a.url || "#"}>{sanitizeText(a.readMoreText) || "Read more"}</SafeLink>
      </div>
      {a.imageUrl ? (
        <div className="ob-article-card__image-wrap">
          <img src={String(a.imageUrl)} alt={sanitizeText(a.title)} loading="lazy" />
        </div>
      ) : null}
    </article>
  );

  if (isCarousel) {
    return (
      <section ref={ref} className="ob-article-carousel ob-carousel--touch" data-columns={columns} style={wrapper}>
        <div className="ob-content-carousel__viewport">
          <div className="ob-content-carousel__track ob-carousel-track--js" style={{ transform: `translateX(-${index * (100 / columns)}%)` }}>
            {list.map((a, i) => (
              <div key={i} className="ob-content-carousel__slide" style={{ flex: `0 0 ${100 / columns}%` }}>
                {renderCard(a, i)}
              </div>
            ))}
          </div>
        </div>
        {mounted && showArrows && list.length > columns ? (
          <div className="ob-carousel-nav" style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end" }}>
            <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(-1)} aria-label="Previous">‹</button>
            <button type="button" className="ob-carousel-btn ob-btn" style={arrowSurface} onClick={() => go(1)} aria-label="Next">›</button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className="cms-auto-grid ob-article-grid"
      data-columns={columns}
      style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, width: "100%", gap: 20, ...wrapper }}
    >
      {list.map((a, i) => renderCard(a, i))}
    </div>
  );
});
ArticleCardGrid.displayName = "Article Card Grid";
