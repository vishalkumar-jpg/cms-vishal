import { isNonEmptyParamValue, topLevelParamsOnlyAllowNonEmpty } from "../convert-module-params";
import { HUBSPOT_IMG_PARAM_KEY } from "../complex-module-param-keys";
import {
  HUBSPOT_PIKE_MODULE_METADATA_WITHOUT_STYLE_KEYS,
  HUBSPOT_PIKE_MODULE_STYLE_METADATA_KEYS,
} from "./hubspot-pike-module-metadata";
import { readStrictHubspotImageObject } from "./hubspot-image-object";
import type { ImageBlockProps } from "./pike-image-to-image";

export { HUBSPOT_IMG_PARAM_KEY };

export const HUBSPOT_LINKED_IMAGE_PATH = "@hubspot/linked_image";

const LINKED_IMAGE_ALLOWED_TOP_LEVEL_KEYS = [
  ...HUBSPOT_PIKE_MODULE_METADATA_WITHOUT_STYLE_KEYS,
  HUBSPOT_IMG_PARAM_KEY,
  "extra_classes",
  "link",
  "target",
] as const;

const readLinkedImageUrl = (link: unknown, target: unknown): string | undefined | null => {
  if (target === true) return null;
  if (target !== undefined && target !== null && typeof target !== "boolean") return null;
  if (link === undefined || link === null || link === "") return undefined;
  if (typeof link !== "string") return null;
  const trimmed = link.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const moduleParamsIncludeLinkedImage = (params: Record<string, unknown>): boolean => {
  if (!(HUBSPOT_IMG_PARAM_KEY in params)) return false;
  return params.path === HUBSPOT_LINKED_IMAGE_PATH;
};

export const tryMapLinkedImageParamsToImageProps = (
  params: Record<string, unknown>,
): ImageBlockProps | null => {
  if (!moduleParamsIncludeLinkedImage(params)) return null;
  for (const key of HUBSPOT_PIKE_MODULE_STYLE_METADATA_KEYS) {
    if (isNonEmptyParamValue(params[key])) return null;
  }
  if (!topLevelParamsOnlyAllowNonEmpty(params, LINKED_IMAGE_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const mapped = readStrictHubspotImageObject(params[HUBSPOT_IMG_PARAM_KEY]);
  if (!mapped) return null;

  const url = readLinkedImageUrl(params.link, params.target);
  if (url === null) return null;

  return {
    imageUrl: mapped.imageUrl,
    ...(mapped.altText ? { altText: mapped.altText } : {}),
    ...(mapped.width !== undefined ? { width: mapped.width } : {}),
    ...(mapped.height !== undefined ? { height: mapped.height } : {}),
    ...(mapped.loading ? { loading: mapped.loading } : {}),
    ...(url ? { url } : {}),
  };
};
