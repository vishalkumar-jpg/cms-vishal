"use client";

import * as React from "react";
import { cssFromMini, cx, SafeLink, sanitizeText, resolveSurfaceStyles, mergeVisualStyles, stripResponsiveTypographyVars, applyRootBlockStyles, applyPartStyles, authoredTextAttr, hasAuthoredSizeStyle, withAuthorTypography } from "../lib";
import { sanitizeSvg } from "@ob-cms/block-schema";
import { EditableText, BlockEditingContext } from "../editable-text";
import { useBoundProp } from "../repeater-context";

/* ---- Count-up number (scroll-triggered) -------------------------- */
type CountUpEasing = "linear" | "ease" | "easeOut" | "easeInOut";

const COUNT_UP_EASINGS: Record<CountUpEasing, (t: number) => number> = {
  linear: (t) => t,
  ease: (t) => t * (2 - t),
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/** Split "$4,000.5+" → prefix, numeric value, suffix, decimal places. */
const parseCountUp = (
  raw: string,
): { prefix: string; num: number | null; suffix: string; decimals: number } => {
  const s = String(raw ?? "").trim();
  const m = s.match(/^([^\d]*?)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return { prefix: "", num: null, suffix: raw, decimals: 0 };
  const numStr = m[2].replace(/,/g, "");
  const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length ?? 0) : 0;
  const num = parseFloat(numStr);
  return {
    prefix: m[1] ?? "",
    num: Number.isNaN(num) ? null : num,
    suffix: m[3] ?? "",
    decimals,
  };
};

const formatCount = (n: number, decimals: number): string =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * Animates a number from 0 → target the first time it scrolls into view (once).
 * SSR / first paint shows the final value so markup is deterministic.
 */
const CountUpText: React.FC<{
  as: React.ElementType;
  num: number;
  prefix: string;
  suffix: string;
  decimals: number;
  duration: number;
  delay: number;
  easing: CountUpEasing;
  style?: React.CSSProperties;
  dataAttrs?: Record<string, string | undefined>;
}> = ({ as: Tag, num, prefix, suffix, decimals, duration, delay, easing, style, dataAttrs }) => {
  const ref = React.useRef<HTMLElement>(null);
  const [shown, setShown] = React.useState<number>(num);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let frame = 0;
    let timer = 0;
    let started = false;
    const ease = COUNT_UP_EASINGS[easing] ?? COUNT_UP_EASINGS.easeOut;
    const animate = (): void => {
      let start = 0;
      const run = (ts: number): void => {
        if (!start) start = ts;
        const p = ease(Math.min(1, (ts - start) / duration));
        setShown(num * p);
        if (p < 1) frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started) {
            started = true;
            setShown(0);
            timer = window.setTimeout(animate, delay);
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [num, duration, delay, easing]);
  return (
    <Tag ref={ref} style={style} {...dataAttrs}>
      {prefix}
      {formatCount(shown, decimals)}
      {suffix}
    </Tag>
  );
};

/* ---- Heading ----------------------------------------------------- */
export const Heading = React.forwardRef<
  HTMLDivElement,
  {
    text?: string;
    highlightText?: string;
    highlightColor?: string;
    level?: number;
    countUp?: boolean;
    countUpDuration?: number;
    countUpDelay?: number;
    countUpEasing?: CountUpEasing;
    styles?: unknown;
  }
>(({ text: rawText, highlightText, highlightColor, level = 2, countUp, countUpDuration = 2000, countUpDelay = 0, countUpEasing = "easeOut", styles }, ref) => {
  // Data-binding: a Repeater descendant may bind `text` to a collection field.
  const text = useBoundProp("text", rawText);
  const lvl = Math.min(Math.max(level, 1), 6);
  const Tag = `h${lvl}` as React.ElementType;
  // Treat a fixed height as minHeight so wrapped text never overflows/overlaps.
  const headingStyle = withAuthorTypography(
    applyRootBlockStyles(styles, {
      heightAsMinHeight: true,
      structural: { margin: 0, display: "block", boxSizing: "border-box" },
    }),
  );
  const headingAttrs = authoredTextAttr(headingStyle);
  // Count-up only in the published renderer. The builder always provides
  // BlockEditingContext, so its presence means "in the editor" → keep the plain
  // editable text (selectable, no distracting animation on the canvas).
  const inBuilder = React.useContext(BlockEditingContext) != null;
  const parsed = countUp ? parseCountUp(text ?? "") : { prefix: "", num: null, suffix: "", decimals: 0 };
  if (countUp && !inBuilder && parsed.num != null) {
    return (
      <div ref={ref} style={{ display: "block", boxSizing: "border-box" }}>
        <CountUpText
          as={Tag}
          num={parsed.num}
          prefix={parsed.prefix}
          suffix={parsed.suffix}
          decimals={parsed.decimals}
          duration={countUpDuration}
          delay={countUpDelay}
          easing={countUpEasing}
          style={headingStyle}
          dataAttrs={headingAttrs}
        />
      </div>
    );
  }
  return (
    <div ref={ref} style={{ display: "block", boxSizing: "border-box" }}>
      <EditableText
        as={Tag as keyof React.JSX.IntrinsicElements}
        propKey="text"
        value={text}
        highlightText={highlightText}
        highlightColor={highlightColor}
        style={headingStyle}
        dataAttrs={headingAttrs}
      />
    </div>
  );
});
Heading.displayName = "Heading";

/* ---- Paragraph --------------------------------------------------- */
export const Paragraph = React.forwardRef<
  HTMLDivElement,
  {
    text?: string;
    highlightText?: string;
    highlightColor?: string;
    styles?: unknown;
  }
>(({ text: rawText, highlightText, highlightColor, styles }, ref) => {
  const text = useBoundProp("text", rawText);
  const paraStyle = withAuthorTypography(
    applyRootBlockStyles(styles, {
      heightAsMinHeight: true,
      structural: { margin: 0, lineHeight: 1.7, display: "block", boxSizing: "border-box" },
    }),
  );
  const paraAttrs = authoredTextAttr(paraStyle);
  return (
    <div ref={ref} style={{ display: "block", boxSizing: "border-box" }}>
      <EditableText
        as="p"
        propKey="text"
        value={text}
        highlightText={highlightText}
        highlightColor={highlightColor}
        style={paraStyle}
        dataAttrs={paraAttrs}
      />
    </div>
  );
});
Paragraph.displayName = "Paragraph";

/* ---- Section Heading -------------------------------------------- */
export const SectionHeading = React.forwardRef<
  HTMLDivElement,
  {
    subtitle?: string;
    title?: string;
    highlightText?: string;
    highlightColor?: string;
    align?: React.CSSProperties["textAlign"];
    styles?: unknown;
  }
>(({ subtitle, title, highlightText, highlightColor = "#147eff", align = "center", styles }, ref) => {
  // A fixed `height` from the source design can clip a heading whose text wraps
  // to more lines at our font metrics, overflowing onto the next block. Treat it
  // as `minHeight` so the heading always grows to fit its content.
  const sectionStyle = applyRootBlockStyles(styles, {
    heightAsMinHeight: true,
    structural: { textAlign: align },
  });
  return (
    <div ref={ref} style={sectionStyle}>
      {subtitle ? (
        <EditableText
          as="p"
          propKey="subtitle"
          value={subtitle}
          className="ob-eyebrow"
          style={{ display: "block", textAlign: align }}
        />
      ) : null}
      <EditableText
        as="h2"
        propKey="title"
        value={title}
        highlightText={highlightText}
        highlightColor={highlightColor}
        style={{ margin: 0, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, lineHeight: 1.15, color: "#002244" }}
      />
    </div>
  );
});
SectionHeading.displayName = "SectionHeading";

/* ---- Image ------------------------------------------------------- */
/** A responsive/next-gen derivative from the media pipeline (see block-schema). */
interface ImageVariant {
  width: number;
  format?: string;
  url: string;
  bytes?: number;
  height?: number;
}

/**
 * Build a `srcset` value ("url 320w, url 640w, …") for one format from the
 * variant list, de-duped + sorted ascending by width. Returns "" when no
 * variant of that format exists (→ caller omits the attribute/source).
 */
function srcSetFor(variants: ImageVariant[], format?: string): string {
  const seen = new Set<number>();
  return variants
    .filter((v) => v && v.url && typeof v.width === "number" && (format ? v.format === format : true))
    .sort((a, b) => a.width - b.width)
    .filter((v) => (seen.has(v.width) ? false : (seen.add(v.width), true)))
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");
}

export const Image = React.forwardRef<
  HTMLElement,
  {
    imageUrl?: string;
    altText?: string;
    url?: string;
    width?: number | string;
    height?: number | string;
    objectFit?: React.CSSProperties["objectFit"];
    inlineSvg?: string;
    imageStyles?: Record<string, unknown>;
    figureClassName?: string;
    // Responsive output — captured from the media library at pick time so the
    // published <img> is self-contained (no renderer fetch).
    variants?: ImageVariant[];
    intrinsicWidth?: number;
    intrinsicHeight?: number;
    focalPoint?: { x: number; y: number };
    sizes?: string;
    loading?: "lazy" | "eager";
    styles?: unknown;
  }
>(({
  imageUrl: rawImageUrl,
  altText: rawAltText,
  url,
  width,
  height,
  objectFit = "contain",
  inlineSvg,
  imageStyles = {},
  figureClassName,
  variants,
  intrinsicWidth,
  intrinsicHeight,
  focalPoint,
  sizes,
  loading = "lazy",
  styles,
}, ref) => {
  // Data-binding: `imageUrl`/`altText` may be bound to collection fields.
  const imageUrl = useBoundProp("imageUrl", rawImageUrl);
  const altText = useBoundProp("altText", rawAltText);
  // Focal point (0–1) → object-position so smart crops stay framed.
  const objectPosition =
    focalPoint && typeof focalPoint.x === "number" && typeof focalPoint.y === "number"
      ? `${(focalPoint.x * 100).toFixed(2)}% ${(focalPoint.y * 100).toFixed(2)}%`
      : undefined;

  // Style-panel width/height land on `styles.sizing` and resolve onto the
  // figure via cssFromStyles — but the <img> kept its own width/height props,
  // so growing the figure only added empty space (white gap) below/beside the
  // image. Pull box-model + object-fit keys off the wrapper and apply them to
  // the actual image element instead.
  const IMG_BOX_KEYS = new Set([
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "objectFit",
    "objectPosition",
  ]);
  const figureCss = applyRootBlockStyles(styles) as React.CSSProperties;
  const imgBoxCss: React.CSSProperties = {};
  const figureStyle: React.CSSProperties = { margin: 0 };
  for (const [key, val] of Object.entries(figureCss)) {
    if (val == null || val === "") continue;
    if (IMG_BOX_KEYS.has(key)) {
      (imgBoxCss as Record<string, unknown>)[key] = val;
    } else {
      (figureStyle as Record<string, unknown>)[key] = val;
    }
  }

  const toCssDim = (v: number | string | undefined): string | number | undefined => {
    if (v == null || v === "") return undefined;
    return typeof v === "number" ? `${v}px` : v;
  };

  const explicitWidth = imgBoxCss.width ?? toCssDim(width);
  const hasStyledWidth = imgBoxCss.width != null && imgBoxCss.width !== "";
  const hasStyledHeight = imgBoxCss.height != null && imgBoxCss.height !== "";
  // Width-only sizing from the panel should scale proportionally (not crop).
  const explicitHeight = hasStyledHeight
    ? imgBoxCss.height
    : hasStyledWidth
      ? undefined
      : toCssDim(height);
  const resolvedWidth = explicitWidth ?? "100%";
  const resolvedHeight = explicitHeight ?? "auto";
  const authorObjectFit = imgBoxCss.objectFit as React.CSSProperties["objectFit"] | undefined;
  const resolvedObjectFit =
    authorObjectFit ?? (explicitWidth != null || explicitHeight != null ? "contain" : objectFit);
  const sizeAttrs =
    hasAuthoredSizeStyle(imgBoxCss) || explicitWidth != null || explicitHeight != null
      ? { "data-ob-authored-size": "" as const }
      : {};

  const imgStyle: React.CSSProperties = {
    width: resolvedWidth,
    height: resolvedHeight,
    minWidth: imgBoxCss.minWidth,
    maxWidth: imgBoxCss.maxWidth ?? (explicitWidth ? undefined : "100%"),
    minHeight: imgBoxCss.minHeight,
    maxHeight: imgBoxCss.maxHeight,
    objectFit: resolvedObjectFit,
    objectPosition:
      (imgBoxCss.objectPosition as React.CSSProperties["objectPosition"]) ?? objectPosition,
    borderRadius: (imageStyles.borderRadius as number) ?? 8,
    display: "block",
  };
  // Inline SVG takes precedence — rendered sanitized (no scripts/handlers/refs)
  // so a vector logo stays crisp + themeable via currentColor.
  const cleanSvg = inlineSvg ? sanitizeSvg(inlineSvg) : "";

  // Responsive plumbing. `eager` images skip lazy-loading and hint high priority
  // (LCP/above-the-fold). `loading="eager"` is also accepted via the `loading` prop.
  const list = Array.isArray(variants) ? variants : [];
  const fallbackSrcSet = srcSetFor(list); // every variant, all formats (the <img> fallback)
  const webpSrcSet = srcSetFor(list, "webp");
  const avifSrcSet = srcSetFor(list, "avif");
  const sizesAttr = fallbackSrcSet ? sizes || "100vw" : undefined;
  // Intrinsic dimensions reserve layout space → no CLS. Skip when the author set
  // explicit CSS box size (otherwise the attribute aspect-ratio fights the style).
  const hasExplicitBox =
    imgBoxCss.width != null ||
    imgBoxCss.height != null ||
    (width != null && width !== "") ||
    (height != null && height !== "" && height !== "auto");
  const wAttr =
    !hasExplicitBox && typeof intrinsicWidth === "number" && intrinsicWidth > 0
      ? intrinsicWidth
      : undefined;
  const hAttr =
    !hasExplicitBox && typeof intrinsicHeight === "number" && intrinsicHeight > 0
      ? intrinsicHeight
      : undefined;
  const isEager = loading === "eager";

  const baseImg = imageUrl ? (
    <img
      src={String(imageUrl)}
      alt={sanitizeText(altText)}
      {...(fallbackSrcSet ? { srcSet: fallbackSrcSet, sizes: sizesAttr } : {})}
      {...(wAttr ? { width: wAttr } : {})}
      {...(hAttr ? { height: hAttr } : {})}
      loading={isEager ? "eager" : "lazy"}
      decoding="async"
      {...(isEager ? { fetchPriority: "high" as const } : {})}
      style={imgStyle}
      {...sizeAttrs}
    />
  ) : null;

  // When next-gen sources exist, wrap in <picture> (AVIF first, then WebP) with
  // the original-format <img> as the universal fallback. Otherwise a plain <img>.
  const responsiveImg =
    baseImg && (webpSrcSet || avifSrcSet) ? (
      <picture
        style={{
          display: "block",
          width: imgStyle.width,
          maxWidth: imgStyle.maxWidth,
          ...(resolvedHeight !== "auto" ? { height: imgStyle.height } : {}),
          lineHeight: 0,
        }}
      >
        {avifSrcSet ? <source type="image/avif" srcSet={avifSrcSet} sizes={sizesAttr} /> : null}
        {webpSrcSet ? <source type="image/webp" srcSet={webpSrcSet} sizes={sizesAttr} /> : null}
        {baseImg}
      </picture>
    ) : (
      baseImg
    );

  const img = cleanSvg ? (
    <span
      className="cms-image-svg"
      role="img"
      aria-label={altText ? sanitizeText(altText) : undefined}
      style={{
        display: "inline-block",
        width: imgStyle.width,
        height: imgStyle.height,
        maxWidth: imgStyle.maxWidth,
        lineHeight: 0,
      }}
      {...sizeAttrs}
      dangerouslySetInnerHTML={{ __html: cleanSvg }}
    />
  ) : responsiveImg ? (
    responsiveImg
  ) : (
    <div style={{ ...imgStyle, background: "#e2e8f0", minHeight: 120 }} />
  );
  return (
    <figure ref={ref} className={cx("cms-image", figureClassName)} style={figureStyle}>
      {url ? (
        <SafeLink url={url} style={{ display: "block", lineHeight: 0 }}>
          {img}
        </SafeLink>
      ) : (
        img
      )}
      {altText && !url ? (
        <figcaption style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
          {sanitizeText(altText)}
        </figcaption>
      ) : null}
    </figure>
  );
});
Image.displayName = "Image";

/* ---- Badge (pill/chip label) ------------------------------------- */
export const Badge = React.forwardRef<
  HTMLSpanElement,
  { text?: string; styles?: unknown }
>(({ text: rawText, styles }, ref) => {
  const text = useBoundProp("text", rawText);
  return (
    <span
      ref={ref}
      className="ob-badge cms-fluid-badge"
      style={applyRootBlockStyles(styles, {
        structural: { display: "inline-block", boxSizing: "border-box" },
      })}
    >
      <EditableText as="span" propKey="text" value={text} />
    </span>
  );
});
Badge.displayName = "Badge";

/** Default palette when no custom styles override the Button variant. Uses longhands only. */
const buttonVariantDefaults = (variant: string): React.CSSProperties => {
  switch (variant) {
    case "secondary":
      return { backgroundColor: "transparent", color: "#147eff", border: "1px solid #147eff" };
    case "ghost":
      return { backgroundColor: "transparent", color: "#147eff", border: "none" };
    case "outline":
      return {
        backgroundColor: "transparent",
        color: "hsl(var(--foreground))",
        border: "2px solid hsl(var(--border))",
      };
    case "danger":
      return { backgroundColor: "#dc2626", color: "#ffffff" };
    case "success":
      return { backgroundColor: "#16a34a", color: "#ffffff" };
    default:
      return { backgroundColor: "#147eff", color: "#ffffff" };
  }
};

const BUTTON_STRUCTURAL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
  textDecoration: "none",
  boxSizing: "border-box",
};

const BUTTON_FALLBACK: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 5,
};

type StyleDict = Record<string, unknown>;

const styleBag = (styles: unknown, section: string): StyleDict =>
  ((styles as StyleDict)?.[section] as StyleDict) ?? {};

const hasStyleKeys = (styles: unknown, section: string, keys: string[]): boolean => {
  const bag = styleBag(styles, section);
  return keys.some((k) => bag[k] != null && bag[k] !== "");
};

/** Apply variant palette only for properties the author has not set in `styles`. */
const buttonResolvedDefaults = (variant: string, styles: unknown): React.CSSProperties => {
  const variantDefs = buttonVariantDefaults(variant);
  const layers: React.CSSProperties[] = [BUTTON_STRUCTURAL];

  if (
    !hasStyleKeys(styles, "spacing", [
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ])
  ) {
    layers.push(BUTTON_FALLBACK);
  }

  const variantLayer: React.CSSProperties = {};
  const colors = styleBag(styles, "colors");
  const hasTextColor =
    hasStyleKeys(styles, "colors", ["textColor", "color"]) ||
    hasStyleKeys(styles, "typography", ["textColor", "color"]);
  const hasBackground =
    colors.backgroundColor != null ||
    colors.backgroundGradient != null ||
    colors.backgroundImage != null;
  const borders = styleBag(styles, "borders");
  const hasBorder = Object.values(borders).some((v) => v != null && v !== "");

  if (!hasTextColor && variantDefs.color) variantLayer.color = variantDefs.color;
  if (!hasBackground && variantDefs.backgroundColor) {
    variantLayer.backgroundColor = variantDefs.backgroundColor;
  }
  if (!hasBorder && variantDefs.border) variantLayer.border = variantDefs.border;

  if (Object.keys(variantLayer).length > 0) layers.push(variantLayer);

  return mergeVisualStyles(...layers);
};

/* ---- Button ------------------------------------------------------ */
export const Button = React.forwardRef<
  HTMLSpanElement,
  {
    label?: string;
    url?: string;
    variant?: string;
    iconAfter?: string;
    partStyles?: Record<string, unknown>;
    styles?: unknown;
  }
>(({ label: rawLabel, url: rawUrl, variant = "primary", iconAfter, partStyles = {}, styles }, ref) => {
  const label = useBoundProp("label", rawLabel);
  const url = useBoundProp("url", rawUrl);
  const partMini = cssFromMini(partStyles);
  const defaults = buttonResolvedDefaults(variant, styles);
  const { wrapper, surface: buttonStyle } = resolveSurfaceStyles(styles, defaults, partMini);

  return (
    <span ref={ref} style={{ display: "inline-block", boxSizing: "border-box", ...wrapper }}>
      <SafeLink url={url} style={buttonStyle} className="ob-btn cms-fluid-btn">
        <EditableText as="span" propKey="label" value={label} style={{ color: "inherit" }} />
        {iconAfter ? (
          <span aria-hidden style={{ color: "inherit" }}>
            {sanitizeText(iconAfter)}
          </span>
        ) : null}
      </SafeLink>
    </span>
  );
});
Button.displayName = "Button";

/* ---- Link -------------------------------------------------------- */
export const Link = React.forwardRef<
  HTMLSpanElement,
  {
    text?: string;
    url?: string;
    linkStyles?: Record<string, unknown>;
    styles?: unknown;
  }
>(({ text: rawText, url: rawUrl, linkStyles = {}, styles }, ref) => {
  const text = useBoundProp("text", rawText);
  const url = useBoundProp("url", rawUrl);
  const mini = cssFromMini(linkStyles);
  const typography = ((styles as Record<string, unknown> | undefined)?.typography ??
    {}) as Record<string, unknown>;
  const hasTextDecoration =
    mini.textDecoration != null || typography.textDecoration != null;
  const linkDefaults: React.CSSProperties = {
    color: mini.color || "#147eff",
    ...(!hasTextDecoration ? { textDecoration: "underline" } : {}),
  };
  // linkStyles are the anchor's dedicated mini-style API; merge them after the
  // StyleModel surface so responsive typography (e.g. largeDesktop overrides)
  // cannot override linkStyles.fontSize on published wide viewports.
  const { wrapper, surface: modelSurface } = resolveSurfaceStyles(styles, linkDefaults);
  const surface = stripResponsiveTypographyVars(mergeVisualStyles(modelSurface, mini), mini);
  const linkWrapper = stripResponsiveTypographyVars(wrapper, mini);

  return (
    <span
      ref={ref}
      className="cms-link ob-link"
      style={{ display: "inline-block", boxSizing: "border-box", ...linkWrapper }}
    >
      <SafeLink url={url} style={surface}>
        <EditableText as="span" propKey="text" value={text} style={{ color: "inherit" }} />
      </SafeLink>
    </span>
  );
});
Link.displayName = "Link";
