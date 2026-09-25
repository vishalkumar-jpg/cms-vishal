import {
  isNonEmptyParamValue,
  isPlainObject,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_CAROUSEL_PARAM_KEY, HUBSPOT_LOGOS_PARAM_KEY } from "../complex-module-param-keys";
import {
  HUBSPOT_PIKE_MODULE_METADATA_WITH_STYLE_KEYS,
  hubspotModulePathEndsWith,
} from "./hubspot-pike-module-metadata";

export { HUBSPOT_LOGOS_PARAM_KEY };

export const HUBSPOT_LOGO_TOUTER_PATH_SUFFIX = "modules/logo-touter";

const ONE_SECOND_MS = 1000;

export interface LogoCarouselBlockProps {
  logos: Array<{ url: string; alt?: string }>;
  carousel?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  showArrows?: boolean;
}

const LOGOS_ALLOWED_TOP_LEVEL_KEYS = [
  ...HUBSPOT_PIKE_MODULE_METADATA_WITH_STYLE_KEYS,
  HUBSPOT_LOGOS_PARAM_KEY,
  HUBSPOT_CAROUSEL_PARAM_KEY,
] as const;

const mapLogoItem = (item: unknown): LogoCarouselBlockProps["logos"][number] | null => {
  if (!isPlainObject(item)) return null;
  for (const key of Object.keys(item)) {
    if (key !== "image" && isNonEmptyParamValue(item[key])) return null;
  }
  const image = item.image;
  if (!isPlainObject(image)) return null;
  for (const key of Object.keys(image)) {
    if (key !== "src" && key !== "alt" && isNonEmptyParamValue(image[key])) return null;
  }
  if (typeof image.src !== "string" || !image.src.trim()) return null;
  if (image.alt !== undefined && image.alt !== null && typeof image.alt !== "string") return null;

  const url = image.src.trim();
  const alt =
    typeof image.alt === "string" && image.alt.trim().length > 0 ? image.alt.trim() : undefined;
  return alt ? { url, alt } : { url };
};

const readCarouselConfig = (
  value: unknown,
): Pick<LogoCarouselBlockProps, "carousel" | "autoplay" | "autoplayInterval" | "showArrows"> | null => {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isPlainObject(value)) return null;
  for (const key of Object.keys(value)) {
    if (
      key !== "autoplay" &&
      key !== "arrows" &&
      key !== "autoplay_interval" &&
      isNonEmptyParamValue(value[key])
    ) {
      return null;
    }
  }
  if (value.autoplay !== undefined && value.autoplay !== null && typeof value.autoplay !== "boolean") {
    return null;
  }
  if (value.arrows !== undefined && value.arrows !== null && typeof value.arrows !== "boolean") {
    return null;
  }
  if (
    value.autoplay_interval !== undefined &&
    value.autoplay_interval !== null &&
    typeof value.autoplay_interval !== "number"
  ) {
    return null;
  }

  const autoplay = value.autoplay === true;
  const showArrows = value.arrows === true;
  const intervalSeconds =
    typeof value.autoplay_interval === "number" && Number.isFinite(value.autoplay_interval)
      ? value.autoplay_interval
      : undefined;

  if (intervalSeconds !== undefined && intervalSeconds <= 0) {
    return null;
  }

  const carousel = autoplay || showArrows || intervalSeconds !== undefined;
  return {
    ...(carousel ? { carousel: true } : {}),
    ...(autoplay ? { autoplay: true } : {}),
    ...(showArrows ? { showArrows: true } : {}),
    ...(intervalSeconds !== undefined
      ? { autoplayInterval: intervalSeconds * ONE_SECOND_MS }
      : {}),
  };
};

export const moduleParamsIncludeLogoTouter = (params: Record<string, unknown>): boolean => {
  if (!(HUBSPOT_LOGOS_PARAM_KEY in params) || !Array.isArray(params[HUBSPOT_LOGOS_PARAM_KEY])) {
    return false;
  }
  return hubspotModulePathEndsWith(params.path, HUBSPOT_LOGO_TOUTER_PATH_SUFFIX);
};

export const tryMapLogoTouterParamsToLogoCarouselProps = (
  params: Record<string, unknown>,
): LogoCarouselBlockProps | null => {
  if (!moduleParamsIncludeLogoTouter(params)) return null;
  if (!topLevelParamsOnlyAllowNonEmpty(params, LOGOS_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const logosRaw = params[HUBSPOT_LOGOS_PARAM_KEY];
  if (!Array.isArray(logosRaw) || logosRaw.length === 0) return null;

  const logos: LogoCarouselBlockProps["logos"] = [];
  for (const item of logosRaw) {
    const mapped = mapLogoItem(item);
    if (!mapped) return null;
    logos.push(mapped);
  }

  const carouselProps = readCarouselConfig(params[HUBSPOT_CAROUSEL_PARAM_KEY]);
  if (carouselProps === null) return null;

  return { logos, ...carouselProps };
};
