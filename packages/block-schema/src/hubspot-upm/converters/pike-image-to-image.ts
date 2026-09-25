import {
  isNonEmptyParamValue,
  isPlainObject,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_IMAGE_PARAM_KEY } from "../complex-module-param-keys";
import {
  HUBSPOT_PIKE_MODULE_METADATA_WITHOUT_STYLE_KEYS,
  HUBSPOT_PIKE_MODULE_STYLE_METADATA_KEYS,
  hubspotModulePathEndsWith,
} from "./hubspot-pike-module-metadata";
import { readStrictHubspotImageObject } from "./hubspot-image-object";

export { HUBSPOT_IMAGE_PARAM_KEY };

export const HUBSPOT_PIKE_IMAGE_PATH_SUFFIX = "modules/image";

export interface ImageBlockProps {
  imageUrl: string;
  altText?: string;
  url?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
}

const PIKE_IMAGE_ALLOWED_TOP_LEVEL_KEYS = [
  ...HUBSPOT_PIKE_MODULE_METADATA_WITHOUT_STYLE_KEYS,
  HUBSPOT_IMAGE_PARAM_KEY,
  "link",
  "link_enabled",
  "mobile",
  "picture",
] as const;

const isValidPikeLinkObject = (value: unknown, linkEnabled: boolean): string | null | undefined => {
  if (value === undefined || value === null) return linkEnabled ? null : undefined;
  if (!isPlainObject(value)) return null;
  for (const key of Object.keys(value)) {
    if (key !== "href" && key !== "type" && isNonEmptyParamValue(value[key])) return null;
  }
  const href = value.href;
  if (href !== undefined && href !== null && typeof href !== "string") return null;
  if (value.type !== undefined && value.type !== null && typeof value.type !== "string") return null;
  const hrefTrimmed = typeof href === "string" ? href.trim() : "";
  if (linkEnabled) {
    return hrefTrimmed.length > 0 ? hrefTrimmed : null;
  }
  return hrefTrimmed.length > 0 ? null : undefined;
};

const isValidMobileGroup = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key !== "image" && isNonEmptyParamValue(value[key])) return false;
  }
  const image = value.image;
  if (image === undefined || image === null) return true;
  if (!isPlainObject(image)) return false;
  for (const key of Object.keys(image)) {
    if (key !== "size_type" && key !== "src" && isNonEmptyParamValue(image[key])) return false;
  }
  if (image.size_type !== undefined && image.size_type !== null && typeof image.size_type !== "string") {
    return false;
  }
  if (image.src !== undefined && image.src !== null && typeof image.src !== "string") return false;
  if (typeof image.src === "string" && image.src.trim().length > 0) return false;
  return true;
};

export const moduleParamsIncludePikeImage = (params: Record<string, unknown>): boolean => {
  if (!(HUBSPOT_IMAGE_PARAM_KEY in params)) return false;
  return hubspotModulePathEndsWith(params.path, HUBSPOT_PIKE_IMAGE_PATH_SUFFIX);
};

export const tryMapPikeImageParamsToImageProps = (
  params: Record<string, unknown>,
): ImageBlockProps | null => {
  if (!moduleParamsIncludePikeImage(params)) return null;
  for (const key of HUBSPOT_PIKE_MODULE_STYLE_METADATA_KEYS) {
    if (isNonEmptyParamValue(params[key])) return null;
  }
  if (!topLevelParamsOnlyAllowNonEmpty(params, PIKE_IMAGE_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const mapped = readStrictHubspotImageObject(params[HUBSPOT_IMAGE_PARAM_KEY]);
  if (!mapped) return null;

  const linkEnabled = params.link_enabled === true;
  if (params.link_enabled !== undefined && params.link_enabled !== null && typeof params.link_enabled !== "boolean") {
    return null;
  }
  const url = isValidPikeLinkObject(params.link, linkEnabled);
  if (url === null) return null;

  if (params.picture === true) return null;
  if (params.picture !== undefined && params.picture !== null && params.picture !== false) return null;

  if (!isValidMobileGroup(params.mobile)) return null;

  return {
    imageUrl: mapped.imageUrl,
    ...(mapped.altText ? { altText: mapped.altText } : {}),
    ...(mapped.width !== undefined ? { width: mapped.width } : {}),
    ...(mapped.height !== undefined ? { height: mapped.height } : {}),
    ...(mapped.loading ? { loading: mapped.loading } : {}),
    ...(url ? { url } : {}),
  };
};
